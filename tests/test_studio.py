import os
import tempfile
import unittest
from unittest.mock import patch

import server


class StudioTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.old_db = server.DB_PATH
        server.DB_PATH = os.path.join(self.temp.name, "studio.sqlite3")
        server.init_db()
        self.repo_id = server.store_repo("example", "project", "https://github.com/example/project", "main", "a" * 40, [
            ("src/auth.py", "Python", "def authenticate_user(token):\n    return token is not None\n"),
            ("src/app.py", "Python", "from .auth import authenticate_user\n"),
        ])

    def tearDown(self):
        server.DB_PATH = self.old_db
        self.temp.cleanup()

    def test_mindmap_groups_files_and_symbols_and_keeps_imports_as_cross_links(self):
        result = server.build_mindmap(self.repo_id)
        kinds = {node["type"] for node in result["nodes"]}
        self.assertTrue({"repository", "folder", "file", "symbol"}.issubset(kinds))
        self.assertTrue(any(edge["kind"] == "imports" for edge in result["edges"]))
        self.assertEqual(result["commit"], "a" * 40)

    def test_artifact_validation_rejects_unknown_citation_paths(self):
        invalid = {"title": "Report", "sections": [{"heading": "Facts", "body": "x", "citations": [{"path": "secret.py", "start": 1, "end": 1}]}]}
        with self.assertRaises(ValueError):
            server.validate_artifact("report", invalid, self.repo_id)

    def test_artifact_validation_accepts_only_real_cited_ranges(self):
        valid = {"title": "Report", "sections": [{"heading": "Entry point", "body": "The function checks a token.", "citations": [{"path": "src/auth.py", "start": 1, "end": 2}]}]}
        normalized = server.validate_artifact("report", valid, self.repo_id)
        self.assertEqual(normalized["sections"][0]["citations"][0]["path"], "src/auth.py")
        valid["sections"][0]["citations"][0]["end"] = 999
        with self.assertRaises(ValueError):
            server.validate_artifact("report", valid, self.repo_id)

    def test_quiz_validation_accepts_multiple_choice_options_and_checks_answer_index(self):
        quiz={"title":"Auth quiz","questions":[{"question":"What does the token function return?","options":["A boolean","A path","A class"],"answer_index":0,"explanation":"It returns whether a token is present.","citations":[{"path":"src/auth.py","start":1,"end":2}]} for _ in range(3)]}
        normalized=server.validate_artifact("quiz",quiz,self.repo_id)
        self.assertEqual(normalized["questions"][0]["answer_index"],0)
        quiz["questions"][0]["answer_index"]=8
        with self.assertRaises(ValueError):server.validate_artifact("quiz",quiz,self.repo_id)

    def test_artifact_table_cascades_when_repository_is_removed(self):
        payload = {"title": "Report", "sections": [{"heading": "Evidence", "body": "See source.", "citations": [{"path": "src/auth.py", "start": 1, "end": 1}]}]}
        with server.connect() as db:
            db.execute("INSERT INTO artifacts VALUES(?,?,?,?,?,?,?,?)", ("artifact-1", self.repo_id, "a" * 40, "report", "Report", "", __import__("json").dumps(payload), server.now()))
            db.execute("DELETE FROM repositories WHERE id=?", (self.repo_id,))
            self.assertIsNone(db.execute("SELECT id FROM artifacts WHERE id=?", ("artifact-1",)).fetchone())

    def test_hosted_route_rejects_requests_without_bearer_auth(self):
        class Probe:
            path="/api/repositories"; headers={}; status=None
            def route_path(self): return self.path
            def send_json(self,status,payload): self.status=status; self.payload=payload
        probe=Probe(); called=[]
        with patch.object(server,"hosted_mode",return_value=True), patch.object(server,"hosted_config_missing",return_value=[]):
            server.Handler._with_auth(probe,lambda:called.append(True))
        self.assertEqual(probe.status,401)
        self.assertFalse(called)

    def test_hosted_bearer_identity_is_scoped_to_database_request_context(self):
        class Probe:
            path="/api/repositories"; headers={"Authorization":"Bearer test-token"}
            def route_path(self): return self.path
            def send_json(self,status,payload): raise AssertionError("unexpected auth rejection")
        probe=Probe(); observed=[]
        with patch.object(server,"hosted_mode",return_value=True), patch.object(server,"hosted_config_missing",return_value=[]), patch.object(server,"validate_supabase_access_token",return_value="user-123"):
            server.Handler._with_auth(probe,lambda:observed.append(server.REQUEST_CONTEXT.user_id))
        self.assertEqual(observed,["user-123"])
        self.assertFalse(hasattr(server.REQUEST_CONTEXT,"user_id"))

    def test_hosted_repository_route_checks_owner_before_calling_handler(self):
        class Cursor:
            def fetchone(self): return None
        class DB:
            def __enter__(self): return self
            def __exit__(self,*args): pass
            def execute(self,*args): return Cursor()
        class Probe:
            path="/api/repositories/abcdef123456/files"; headers={"Authorization":"Bearer test-token"}; status=None
            def route_path(self): return self.path
            def send_json(self,status,payload): self.status=status; self.payload=payload
        probe=Probe(); called=[]
        with patch.object(server,"hosted_mode",return_value=True), patch.object(server,"hosted_config_missing",return_value=[]), patch.object(server,"validate_supabase_access_token",return_value="user-123"), patch.object(server,"connect",return_value=DB()):
            server.Handler._with_auth(probe,lambda:called.append(True))
        self.assertEqual(probe.status,404)
        self.assertFalse(called)

    def test_postgres_adapter_translates_conflict_ignore_and_placeholders(self):
        adapter=server.PostgresConnection.__new__(server.PostgresConnection)
        sql=adapter._sql("INSERT OR IGNORE INTO edges(repo_id,source) VALUES(?,?)")
        self.assertEqual(sql,"INSERT INTO edges(repo_id,source) VALUES(%s,%s) ON CONFLICT DO NOTHING")

    def test_vercel_rewrite_path_keeps_original_route_and_query(self):
        class Probe:
            path="/api?__path=%2Fapi%2Frepositories%2Fabc%2Ffile&path=src%2Fauth.py"
        probe=Probe()
        route=server.Handler.route_path(probe)
        self.assertEqual(route,"/api/repositories/abc/file")
        self.assertEqual(probe.query_params,{"path":"src/auth.py"})

    def test_report_generation_validates_model_citations_before_returning(self):
        report={"title":"Authentication flow","summary":"The indexed excerpt defines token validation.","sections":[{"heading":"Validator","body":"The function checks the supplied token.","citations":[{"path":"src/auth.py","start":1,"end":2}]}],"caveats":"Only the matched excerpt was reviewed."}
        with patch.object(server,"NVIDIA_API_KEY","configured"), patch.object(server,"call_nvidia",return_value=__import__("json").dumps(report)):
            result=server.generate_artifact(self.repo_id,"report","authenticate_user","feature trace")
        self.assertEqual(result["sections"][0]["citations"][0]["path"],"src/auth.py")


if __name__ == "__main__":
    unittest.main()
