const avatarMap = new Map([
  [1, "public/1.gif"],
  [2, "public/2.gif"],
  [3, "public/3.gif"],
  [4, "public/4.gif"],
  [5, "public/5.gif"],
  [6, "public/6.gif"],
  [7, "public/7.gif"],
  [8, "public/8.gif"],
  [9, "public/scout-running.gif"],
  [10, "public/bruiser-running.gif"],
  [11, "public/titan-running.gif"],
  [12, "public/rookie.gif"],
  [13, "public/runner.gif"],
  [14, "public/soldier-boy.gif"],
  [15, "public/bombat.gif"],
  [16, "public/zoniac.gif"],
]);

export function getAvatarPath(id) {
  return avatarMap.get(id) || "public/rookie.gif";
}
