async function handleRecasterClick() {
  try {
    const data = await fetchCastData();
    // Redirect to Recaster
    const baseUrl = "https://recaster.org";
    const url = data?.hash ? `${baseUrl}/cast/${data.hash}` : baseUrl;
    frame.sdk.actions.openUrl(url);
  } catch (err) {
    if (err.name === "NotAllowedError") {
      showToast(
        "Failed to read from clipboard. Please make sure clipboard access is allowed.",
        "error"
      );
    }
  }
}

async function handleSupercastClick() {
  try {
    const data = await fetchCastData();
    // Redirect to Supercast
    const baseUrl = "https://www.super.sc";
    const url = data?.hash ? `${baseUrl}/c/${data.hash}` : baseUrl;
    frame.sdk.actions.openUrl(url);
  } catch (err) {
    if (err.name === "NotAllowedError") {
      showToast(
        "Failed to read from clipboard. Please make sure clipboard access is allowed.",
        "error"
      );
    }
  }
}

async function handleFireflyClick() {
  try {
    const data = await fetchCastData();
    // Redirect to Firefly
    const baseUrl = "https://firefly.mask.social";
    const url = data?.hash ? `${baseUrl}/post/farcaster/${data.hash}` : baseUrl;
    frame.sdk.actions.openUrl(url);
  } catch (err) {
    if (err.name === "NotAllowedError") {
      showToast(
        "Failed to read from clipboard. Please make sure clipboard access is allowed.",
        "error"
      );
    }
  }
}

async function handleNeynarExplorerClick() {
  try {
    const data = await fetchCastData();
    // Redirect to Neynar
    const baseUrl = "https://explorer.neynar.com";
    const url = data?.hash ? `${baseUrl}/${data.hash}` : baseUrl;
    frame.sdk.actions.openUrl(url);
  } catch (err) {
    if (err.name === "NotAllowedError") {
      showToast(
        "Failed to read from clipboard. Please make sure clipboard access is allowed.",
        "error"
      );
    }
  }
}
