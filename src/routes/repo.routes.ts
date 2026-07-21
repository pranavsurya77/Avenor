import { Router } from "express";
import {
    fetchIssues,
    fetchTree,
    fetchCombined,
    cloneRepoController,
    cleanWorkspaceController,
    cleanRepoCloneController
} from "../controller/github.controller.js";

const router = Router();

// Clean entire workspace (clears all cloned repos)
router.route("/repos/clean").get(cleanWorkspaceController).delete(cleanWorkspaceController);

// Clone repository locally
router.route("/repos/:owner/:repo/clone").get(cloneRepoController);

// Clean a specific repository clone
router.route("/repos/:owner/:repo/clean").get(cleanRepoCloneController).delete(cleanRepoCloneController);

// Issues only
router.route("/repos/:owner/:repo/issues").get(fetchIssues);
router.route("/repos/:owner/:repo/issues/:branch").get(fetchIssues);

// Full recursive file tree only (default branch: main)
router.route("/repos/:owner/:repo/tree").get(fetchTree);
router.route("/repos/:owner/:repo/tree/:branch").get(fetchTree);

// Combined: Issues + full recursive file tree (default branch: main)
router.route("/repos/:owner/:repo").get(fetchCombined);
router.route("/repos/:owner/:repo/branch/:branch").get(fetchCombined);

export { router as githubRoutes };
