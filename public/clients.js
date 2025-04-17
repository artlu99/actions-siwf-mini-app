async function redirect(baseUrl, pathPart) {
  try {
    const data = await fetchCastData();
    frame.sdk.actions.openUrl(`${baseUrl}${pathPart(data.hash)}`);
  } catch (err) {
    if (err.name === "NotAllowedError") {
      showToast(
        "Failed to read from clipboard. Please make sure clipboard access is allowed.",
        "error"
      );
    }
  }
}

async function handleRecasterClick() {
  await redirect("https://recaster.org", (h) => (h ? `/cast/${h}` : ""));
}

async function handleSupercastClick() {
  await redirect("https://www.super.sc", (h) => (h ? `/c/${h}` : ""));
}

async function handleFireflyClick() {
  await redirect("https://firefly.mask.social", (h) =>
    h ? `/post/farcaster/${h}` : ""
  );
}

async function handleNeynarExplorerClick() {
  await redirect("https://explorer.neynar.com", (h) => (h ? `/${h}` : ""));
}
