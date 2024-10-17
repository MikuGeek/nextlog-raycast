import { showHUD, getPreferenceValues, LaunchProps } from "@raycast/api";
import fetch from "node-fetch";
import { QuickAddArguments, Preferences } from "./util";

export default async function main(props: LaunchProps<{ arguments: QuickAddArguments }>) {
  const { type, text } = props.arguments;
  const preferences = getPreferenceValues<Preferences>();

  if (!text) {
    await showHUD("Please provide some text to add to Logseq");
    return;
  }

  const fullText = type ? `${type} ${text}` : text;

  const today = new Date();
  const journalPageName = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;

  try {
    const response = await fetch(preferences.logseqApiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${preferences.logseqApiToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        method: "logseq.Editor.appendBlockInPage",
        args: [journalPageName, fullText]
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log("Logseq API response:", result);

    await showHUD("Added to Logseq journal");
  } catch (error) {
    console.error("Error:", error);
    await showHUD("Failed to add to Logseq journal");
  }
}
