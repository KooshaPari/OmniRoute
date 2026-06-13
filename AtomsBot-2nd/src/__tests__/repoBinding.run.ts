import { getRepoCredentialsForThread } from "../github/githubActions";
import { Thread } from "../interfaces";

const t1: Thread = {
  id: "t1",
  title: "Test",
  appliedTags: [],
  comments: [],
  archived: false,
  locked: false,
  repoOwner: "owner1",
  repoName: "repo1",
  number: 101,
};

const t2: Thread = {
  id: "t2",
  title: "Test2",
  appliedTags: [],
  comments: [],
  archived: false,
  locked: false,
};

console.log("t1 rc:", getRepoCredentialsForThread(t1 as any));
console.log("t2 rc:", getRepoCredentialsForThread(t2 as any));

