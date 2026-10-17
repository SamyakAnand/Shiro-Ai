import os
import unittest


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class ShiroWorkspaceShellTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open(os.path.join(ROOT, "web", "index.html"), encoding="utf-8") as page:
            cls.html = page.read()

    def test_home_is_the_full_shiro_workspace_not_a_marketing_landing_page(self):
        self.assertIn('id="workspace-shell"', self.html)
        self.assertIn('id="repo-list"', self.html)
        self.assertNotIn('class="hero"', self.html)
        self.assertNotIn('class="companion-launcher"', self.html)

    def test_main_workspace_owns_the_shiro_conversation(self):
        ask_view = self.html.split('id="view-ask"', 1)[1].split('id="view-files"', 1)[0]
        self.assertIn('id="companion-messages"', ask_view)
        self.assertIn('id="companion-form"', ask_view)
        self.assertIn('id="shiro-portrait"', self.html)

    def test_repository_tools_remain_available_as_workspace_views(self):
        for view in ("ask", "files", "graph", "investigations"):
            self.assertIn(f'data-tab="{view}"', self.html)
            self.assertIn(f'id="view-{view}"', self.html)


if __name__ == "__main__":
    unittest.main()
