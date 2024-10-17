import { ActionPanel, List, Action, showToast, Toast, getPreferenceValues, open, Icon } from "@raycast/api";
import { useState, useEffect, useMemo } from "react";
import fetch from "node-fetch";
import Fuse from "fuse.js";
import { Preferences, extractUrl, Block } from "./util";

export default function Command() {
  const [searchText, setSearchText] = useState("");
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const preferences = getPreferenceValues<Preferences>();

  useEffect(() => {
    fetchBlocks();
  }, []);

  const fuse = useMemo(
    () =>
      new Fuse(blocks, {
        keys: ["content", "page.name"],
        threshold: 0.2,
        includeMatches: true,
        minMatchCharLength: 2,
        ignoreLocation: true,
        findAllMatches: true,
      }),
    [blocks],
  );

  const filteredBlocks = useMemo(() => {
    if (!searchText || searchText.length <= 1) return [];
    return fuse.search(searchText).map((result) => result.item);
  }, [searchText, blocks, fuse]);

  async function fetchBlocks() {
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
        const fetchedBlocks = data.map((item: [Block]) => item[0]);
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
      const pageName = encodeURIComponent(block.page?.name || "");
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
      searchBarPlaceholder="Search Logseq blocks... (type at least 2 characters)"
      throttle
    >
      {searchText.length <= 1 ? (
        <List.EmptyView icon={Icon.MagnifyingGlass} title="Enter at least 2 characters to search" />
      ) : (
        filteredBlocks.map((block) => {
          const url = extractUrl(block.content);
          return (
            <List.Item
              key={block.uuid}
              title={block.content}
              subtitle={block.page?.name || ""}
              actions={
                <ActionPanel>
                  <Action title="Open in Logseq" icon={Icon.ArrowRight} onAction={() => openInLogseq(block)} />
                  <Action.CopyToClipboard
                    title="Copy Block Content"
                    content={block.content}
                    shortcut={{ modifiers: ["cmd"], key: "c" }}
                  />
                  {url && (
                    <Action.OpenInBrowser
                      title="Open URL in Browser"
                      url={url}
                      shortcut={{ modifiers: ["cmd"], key: "o" }}
                    />
                  )}
                </ActionPanel>
              }
            />
          );
        })
      )}
    </List>
  );
}
