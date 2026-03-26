import simpleGit, { SimpleGit } from "simple-git";
import { Octokit } from "@octokit/rest";

/**
 * Manages Git operations for generated projects.
 */
export class GitManager {
  private octokit: Octokit | null = null;

  constructor(token?: string) {
    const ghToken = token || process.env.GITHUB_TOKEN;
    if (ghToken) {
      this.octokit = new Octokit({ auth: ghToken });
    }
  }

  /** Clone a remote repo into the target directory. */
  async clone(repoUrl: string, targetDir: string, branch?: string): Promise<SimpleGit> {
    const cloneArgs = branch
      ? ["--branch", branch, "--single-branch"]
      : [];

    // Inject token for private repo auth if available
    let url = repoUrl;
    const ghToken = process.env.GITHUB_TOKEN;
    if (ghToken && url.startsWith("https://github.com/")) {
      url = url.replace("https://github.com/", `https://${ghToken}@github.com/`);
    }

    const git = simpleGit();
    await git.clone(url, targetDir, cloneArgs);
    const clonedGit = simpleGit(targetDir);
    await clonedGit.addConfig("user.email", "platform@automated.dev");
    await clonedGit.addConfig("user.name", "AI Platform");
    return clonedGit;
  }

  /** Initialize a git repo in the given directory. */
  async init(dir: string): Promise<SimpleGit> {
    const git = simpleGit(dir);
    await git.init();
    await git.addConfig("user.email", "platform@automated.dev");
    await git.addConfig("user.name", "AI Platform");
    return git;
  }

  /** Stage all and commit with a message. */
  async commit(dir: string, message: string): Promise<string> {
    const git = simpleGit(dir);
    await git.add(".");
    const result = await git.commit(message);
    return result.commit;
  }

  /** Create a GitHub repo and push the local repo to it. */
  async createAndPush(
    dir: string,
    repoName: string,
    isPrivate = true
  ): Promise<string> {
    if (!this.octokit) {
      throw new Error("GITHUB_TOKEN not configured — cannot push to GitHub");
    }

    const { data } = await this.octokit.repos.createForAuthenticatedUser({
      name: repoName,
      private: isPrivate,
      auto_init: false,
    });

    const git = simpleGit(dir);
    await git.addRemote("origin", data.clone_url);
    await git.push("origin", "main", ["--set-upstream"]);

    return data.html_url;
  }

  /** Push existing repo to its remote. */
  async push(dir: string, branch?: string): Promise<void> {
    const git = simpleGit(dir);
    await git.push("origin", branch || "main");
  }

  /** Create and checkout a new branch. */
  async createBranch(dir: string, branchName: string): Promise<void> {
    const git = simpleGit(dir);
    await git.checkoutLocalBranch(branchName);
  }

  /** List branches. */
  async listBranches(dir: string) {
    const git = simpleGit(dir);
    return git.branchLocal();
  }
}
