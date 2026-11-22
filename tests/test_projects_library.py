"""The project library is static frontend data; guard its wiring and size."""

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class ProjectLibraryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = (ROOT / "static/js/core/projects-data.js").read_text(encoding="utf-8")
        cls.index = (ROOT / "static/index.html").read_text(encoding="utf-8")
        cls.feature = (ROOT / "static/js/features/projects.js").read_text(encoding="utf-8")
        cls.config = (ROOT / "app/services/config.py").read_text(encoding="utf-8")
        cls.auth = (ROOT / "static/js/features/auth.js").read_text(encoding="utf-8")

    def test_library_has_a_large_unique_set(self):
        specialties = re.findall(r'^\s+specialty: "([a-z0-9-]+)",', self.data, re.M)
        ids = re.findall(r'^\s+id: "([a-z0-9-]+)",', self.data, re.M)
        self.assertGreaterEqual(len(specialties), 100)
        self.assertEqual(len(ids), len(set(ids)), "project and specialty ids must be unique")
        self.assertIn("window.techmapProjectIdeas", self.data)

    def test_page_wires_the_tab_assets_and_panel(self):
        self.assertIn('data-tab="projects"', self.index)
        self.assertIn('id="projects"', self.index)
        self.assertIn('id="projectDialog"', self.index)
        self.assertIn('id="projectBeginnerCount"', self.index)
        self.assertIn('id="projectBuildingCount"', self.index)
        self.assertIn('id="projectViewList"', self.index)
        self.assertIn("My list only", self.index)
        self.assertIn("Showing all", self.feature)
        self.assertNotIn("briefs shown", self.feature)
        self.assertIn("css/projects.css", self.index)
        self.assertIn("js/core/projects-data.js", self.index)
        self.assertIn("js/features/projects.js", self.index)
        self.assertIn('if (target === "projects") window.loadProjects?.();', self.index + (ROOT / "static/js/features/app.js").read_text(encoding="utf-8"))

    def test_saved_state_is_part_of_account_sync(self):
        self.assertIn('"techmap_projects"', self.config)
        self.assertIn('"techmap_projects"', self.auth)
        self.assertIn("localStorage", self.feature)
        self.assertIn("window.loadProjects", self.feature)

    def test_portfolio_handoff_exists(self):
        portfolio = (ROOT / "static/js/features/portfolio.js").read_text(encoding="utf-8")
        self.assertIn("addProjectIdea", portfolio)
        self.assertIn("addProjectIdea", self.feature)


if __name__ == "__main__":
    unittest.main()
