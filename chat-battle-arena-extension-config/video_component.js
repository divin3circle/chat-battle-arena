const twitch = window.Twitch?.ext;
if (twitch?.onAuthorized) {
  twitch.onAuthorized((auth) => {
    console.log("The Arena video component authorized", auth.channelId);
  });
}
