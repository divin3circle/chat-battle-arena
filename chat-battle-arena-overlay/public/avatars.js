const avatarMap = new Map([
  [1, "/avatars/spear.gif"],
  [2, "/avatars/ball.gif"],
  [3, "/avatars/walker.gif"],
  [4, "/avatars/bat.gif"],
  [5, "/avatars/bomber.gif"],
  [6, "/avatars/ufo.gif"],
  [7, "/avatars/slug.gif"],
  [8, "/avatars/glizzy.gif"],
  [9, "/avatars/scout-running.gif"],
  [10, "/avatars/bruiser-running.gif"],
  [11, "/avatars/titan-running.gif"],
  [12, "/avatars/rookie.gif"],
  [13, "/avatars/runner.gif"],
  [14, "/avatars/soldier-boy.gif"],
  [15, "/avatars/bombat.gif"],
  [16, "/avatars/zoniac.gif"],
]);

export function getAvatarPath(id) {
  return avatarMap.get(id) || "/avatars/walker.gif";
}
