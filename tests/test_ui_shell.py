import os
from pathlib import Path
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

    def test_desktop_uses_one_plain_language_navigation_in_the_repository_sidebar(self):
        self.assertIn('class="workspace-navigation"', self.html)
        self.assertNotIn('class="workspace-tabs"', self.html)
        for label in ("Ask SHIRO", "Understand architecture", "Find source files", "Learn with SHIRO", "Saved investigations"):
            self.assertIn(f">{label}</strong>", self.html)

    def test_mobile_drawer_hides_the_second_feature_navigation(self):
        css = Path(os.path.join(ROOT, "web", "styles.css")).read_text(encoding="utf-8")
        self.assertIn(".workspace-navigation,.sidebar-section-heading,.sidebar-divider{display:none}", css)
        self.assertIn(".repo-search-wrap[hidden]{display:none}", css)

    def test_first_run_guides_repository_connection_before_chat(self):
        self.assertIn('id="first-run-panel"', self.html)
        self.assertIn('data-action="connect"', self.html.split('id="first-run-panel"', 1)[1].split('</div>', 1)[0])
        self.assertIn('class="conversation-intro requires-repo"', self.html)
        self.assertIn('Connect a public GitHub repository', self.html)

    def test_guided_tour_does_not_open_over_the_workspace_automatically(self):
        self.assertIn('if(!tour.active){panel.hidden=true;return;}', Path(os.path.join(ROOT, "web", "app.js")).read_text(encoding="utf-8"))

    def test_repository_tools_remain_available_as_workspace_views(self):
        for view in ("ask", "files", "graph", "investigations", "studio"):
            self.assertIn(f'data-tab="{view}"', self.html)
            self.assertIn(f'id="view-{view}"', self.html)

    def test_visual_explanations_and_study_outputs_are_in_the_workspace(self):
        self.assertIn('id="mindmap-view"', self.html)
        self.assertIn('data-visual="mindmap"', self.html)
        for output in ("report", "flashcards", "quiz"):
            self.assertIn(f'data-output="{output}"', self.html)

    def test_architecture_visualization_is_available_alongside_existing_views(self):
        self.assertIn('data-visual="architecture"', self.html)
        self.assertIn('id="architecture-view"', self.html)

    def test_guided_tour_has_real_action_gates_and_skip(self):
        self.assertIn('id="tour-panel"', self.html)
        self.assertIn('data-action="tour-next"', self.html)
        self.assertIn('data-action="tour-skip"', self.html)


if __name__ == "__main__":
    unittest.main()
