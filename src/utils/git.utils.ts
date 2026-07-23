import { simpleGit } from "simple-git";

/**
 * Ensures the repository is clean and checks out/creates the working branch.
 * If the branch already exists, it checks it out and resets it to a clean state.
 * 
 * @param repoPath - Absolute path to the local repository.
 * @param branchName - The name of the working branch.
 */
export async function setupWorkingBranch(
    repoPath: string,
    branchName: string
): Promise<string> {
    const git = simpleGit(repoPath);

    try {
        const branches = await git.branchLocal();
        const branchExists = branches.all.includes(branchName);

        if (branchExists) {
            console.log(`[GitUtils] Branch '${branchName}' already exists. Checking it out...`);
            await git.checkout(branchName);
            await git.clean("f", ["-d", "-x"]);
            await git.reset(["--hard"]);
        } else {
            console.log(`[GitUtils] Cleaning repository before creating new branch...`);
            await git.clean("f", ["-d", "-x"]);
            await git.reset(["--hard"]);
            await git.checkoutLocalBranch(branchName);
            console.log(`[GitUtils] Created and checked out new working branch: ${branchName}`);
        }

        return branchName;
    } catch (error: any) {
        console.error(`[GitUtils] Failed to setup branch ${branchName}:`, error.message);
        throw new Error(`Failed to initialize working branch: ${error.message}`);
    }
}
