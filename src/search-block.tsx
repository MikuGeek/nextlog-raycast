import { ActionPanel, List, Action, showToast, Toast, getPreferenceValues, open } from "@raycast/api";
import { useState, useEffect } from "react";
import fetch from "node-fetch";

interface Block {
  uuid: string;
  content: string;
  page: {
    name: string;
  };
}

interface Preferences {
  logseqApiUrl: string;
  logseqApiToken: string;
  logseqGraphName: string;
}

export default function Command() {
  const [searchText, setSearchText] = useState("");
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const preferences = getPreferenceValues<Preferences>();

  useEffect(() => {
    searchBlocks(searchText);
  }, [searchText]);

  async function searchBlocks(query: string) {
    setIsLoading(true);
    try {
      const response = await fetch(preferences.logseqApiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${preferences.logseqApiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          method: "logseq.DB.datascriptQuery",
          args: [
            `
            [:find (pull ?b [:block/uuid :block/content {:block/page [:db/id :block/name]}])
             :where
             [?b :block/content ?content]
             [(clojure.string/includes? ?content "${query}")]
             [?b :block/page ?p]]
          `,
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (Array.isArray(data)) {
        const fetchedBlocks = data.slice(0, 20).map((item: [Block]) => item[0]);
        setBlocks(fetchedBlocks);
      }
    } catch (error) {
      console.error("Error fetching blocks:", error);
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to fetch blocks",
        message: "Please check your Logseq API connection",
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function openInLogseq(block: Block) {
    try {
      const graphName = encodeURIComponent(preferences.logseqGraphName);
      const pageName = encodeURIComponent(block.page.name);
      const blockId = encodeURIComponent(block.uuid);
      await open(`logseq://graph/${graphName}?page=${pageName}&block-id=${blockId}`);
    } catch (error) {
      console.error("Error opening in Logseq:", error);
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to open in Logseq",
        message: "Make sure Logseq is installed and running",
      });
    }
  }

  return (
    <List
      isLoading={isLoading}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search Logseq blocks..."
      throttle
    >
      {blocks.map((block) => (
        <List.Item
          key={block.uuid}
          title={block.content}
          subtitle={block.page.name}
          actions={
            <ActionPanel>
              <Action title="Open in Logseq" onAction={() => openInLogseq(block)} />
              <Action.CopyToClipboard
                title="Copy Block Content"
                content={block.content}
                shortcut={{ modifiers: ["cmd"], key: "c" }}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
