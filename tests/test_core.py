import io
import json
import os
import tempfile
import unittest
import zipfile
from unittest.mock import patch

import server


class RepositorySafetyTests(unittest.TestCase):
    def test_default_port_avoids_the_existing_model_service_port(self):
        self.assertEqual(server.DEFAULT_PORT, 8001)

    def test_github_url_requires_https_and_exact_host(self):
        owner, name, branch = server.github_url("https://github.com/example/project/tree/main")
        self.assertEqual((owner, name, branch), ("example", "project", "main"))
        for url in (
            "http://github.com/example/project",
            "https://github.com.example.net/example/project",
            "https://user@github.com/example/project",
            "https://github.com/example/project/../../etc",
            "https://github.com/example/project.git",
        ):
            with self.subTest(url=url), self.assertRaises(ValueError):
                server.github_url(url)

    def test_zip_index_skips_traversal_dependencies_and_binary_files(self):
        archive = io.BytesIO()
        with zipfile.ZipFile(archive, "w") as z:
            z.writestr("owner-repo/src/app.py", "def run():\n    return True\n")
            z.writestr("owner-repo/../../escape.py", "bad = True")
            z.writestr("owner-repo/node_modules/pkg/index.js", "bad()")
            z.writestr("owner-repo/image.py", b"\x00binary")
            z.writestr("owner-repo/data.bin", b"binary")
        result = server.parse_zip(archive.getvalue())
        self.assertEqual([f[0] for f in result], ["src/app.py"])
        self.assertEqual(result[0][1], "Python")

    def test_python_structure_extracts_real_symbols_and_imports(self):
        symbols, imports = server.structure("r", "app.py", "Python", "import os\nfrom pathlib import Path\nclass App:\n    def run(self):\n        pass\n")
        self.assertIn(("App", "class", 3), symbols)
        self.assertIn(("run", "function", 4), symbols)
        self.assertEqual(imports, ["os", "pathlib"])


class RetrievalTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.old_db = server.DB_PATH
        server.DB_PATH = os.path.join(self.temp.name, "test.sqlite3")
        server.init_db()
        server.store_repo("example", "project", "https://github.com/example/project", "main", "a" * 40, [
            ("src/auth.py", "Python", "def authenticate_user(token):\n    return token is not None\n"),
            ("src/app.py", "Python", "from .auth import authenticate_user\n"),
        ])
        with server.connect() as db:
            self.repo_id = db.execute("SELECT id FROM repositories").fetchone()[0]

    def tearDown(self):
        server.DB_PATH = self.old_db
        self.temp.cleanup()

    def test_retrieval_returns_real_paths_and_line_ranges(self):
        results = server.retrieve(self.repo_id, "authenticate user")
        self.assertTrue(results)
        self.assertEqual(results[0]["path"], "src/auth.py")
        self.assertGreaterEqual(results[0]["excerpts"][0]["start"], 1)
        self.assertIn("authenticate_user", results[0]["excerpts"][0]["text"])

    def test_answer_abstains_without_matching_evidence(self):
        answer = server.api_answer(self.repo_id, "quantum pineapple spaceship")
        self.assertEqual(answer["evidence"], [])
        self.assertIn("couldn't find matching evidence", answer["answer"])

    def test_configured_nvidia_answer_uses_only_the_fixed_free_model(self):
        original_key = server.NVIDIA_API_KEY
        server.NVIDIA_API_KEY = "test-secret"
        captured = {}

        class Response:
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def read(self, limit=-1):
                return json.dumps({"choices": [{"message": {"content": "Authentication is in auth.py."}}]}).encode()

        def fake_urlopen(request, timeout):
            captured["url"] = request.full_url
            captured["body"] = json.loads(request.data)
            captured["auth"] = request.get_header("Authorization")
            captured["timeout"] = timeout
            return Response()

        try:
            with patch.object(server.urllib.request, "urlopen", fake_urlopen):
                answer = server.api_answer(self.repo_id, "Where is authenticate_user defined?")
        finally:
            server.NVIDIA_API_KEY = original_key

        self.assertEqual(captured["url"], server.NVIDIA_API_URL)
        self.assertEqual(captured["body"]["model"], "google/gemma-4-31b-it")
        self.assertEqual(captured["auth"], "Bearer test-secret")
        self.assertIn("auth.py", answer["answer"])
        self.assertEqual(answer["provider"], "nvidia")
        self.assertTrue(answer["evidence"])

    def test_nvidia_is_not_called_without_matching_source_evidence(self):
        original_key = server.NVIDIA_API_KEY
        server.NVIDIA_API_KEY = "test-secret"
        try:
            with patch.object(server.urllib.request, "urlopen", side_effect=AssertionError("must abstain locally")):
                answer = server.api_answer(self.repo_id, "quantum pineapple spaceship")
        finally:
            server.NVIDIA_API_KEY = original_key
        self.assertEqual(answer["provider"], "local")

    def test_dotenv_loader_does_not_override_process_environment(self):
        with tempfile.TemporaryDirectory() as folder:
            path = os.path.join(folder, ".env")
            with open(path, "w", encoding="utf-8") as f:
                f.write("NVIDIA_API_KEY=file-value\nNVIDIA_MODEL=ignored-value\n")
            with patch.dict(os.environ, {"NVIDIA_API_KEY": "process-value"}, clear=False):
                values = server.read_local_env(path)
                self.assertEqual(os.environ["NVIDIA_API_KEY"], "process-value")
        self.assertEqual(values["NVIDIA_API_KEY"], "file-value")
        self.assertNotIn("NVIDIA_MODEL", values)


if __name__ == "__main__":
    unittest.main()
