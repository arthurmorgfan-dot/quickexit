export type BuildInfo = { identifier: string; commit: string | null; dirty: boolean; version: "0.11.6" };
/** Only a full Git SHA and a dirty marker may cross the public boundary. */
export function publicBuildInfo(value: string | undefined): BuildInfo {
  const match = /^git-([a-f0-9]{40})(-dirty)?$/.exec(value ?? "");
  return match
    ? { identifier: value!, commit: match[1], dirty: !!match[2], version: "0.11.6" }
    : { identifier: "unidentified", commit: null, dirty: false, version: "0.11.6" };
}
export function resolveBuildIdentifier(commitValue?: string, gitHead?: string, dirty = false): string {
  const commit = commitValue?.trim();
  if (commit && !/^[a-f0-9]{40}$/i.test(commit)) throw Error("Build commit must be a full Git SHA.");
  const head = gitHead?.trim();
  if (head && !/^[a-f0-9]{40}$/i.test(head)) throw Error("Invalid local Git commit.");
  if (commit && head && commit.toLowerCase() !== head.toLowerCase()) throw Error("Build commit does not match the checkout.");
  const sha = (commit || head)?.toLowerCase();
  return sha ? `git-${sha}${dirty ? "-dirty" : ""}` : "unidentified";
}
export const buildInfo = () => publicBuildInfo(process.env.NEXT_PUBLIC_QUICKEXIT_BUILD_ID);
