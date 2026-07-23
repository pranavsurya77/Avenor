import { Router } from "express";
import {
    fetchIssues,
    fetchTree,
    fetchCombined,
    fetchUserRepos,
    cloneRepoController,
    cleanWorkspaceController,
    cleanRepoCloneController
} from "../controller/github.controller.js";
import { isLoggedIn } from "../middleware/login.middleware.js";

const router = Router();

// Fetch repositories for logged-in user or specific username
router.route("/user/repos").get(isLoggedIn, fetchUserRepos);
router.route("/users/:username/repos").get(fetchUserRepos);

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
