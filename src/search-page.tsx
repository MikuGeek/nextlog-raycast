import { ActionPanel, List, Action, showToast, Toast, getPreferenceValues, open, Icon } from "@raycast/api";
import { useState, useEffect, useMemo } from "react";
import fetch from "node-fetch";
import Fuse from "fuse.js";
import { Page, Preferences, cleanContent, Block, fuseOptions } from "./util";

export default function Command() {
  const [searchText, setSearchText] = useState("");
  const [pages, setPages] = useState<Page[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const preferences = getPreferenceValues<Preferences>();

  useEffect(() => {
    fetchPages();
  }, []);

  const fuse = useMemo(
    () => new Fuse(pages, fuseOptions),
    [pages]
  );

  const filteredPages = useMemo(() => {
    if (!searchText || searchText.length <= 1) return [];
    return fuse.search(searchText).map((result) => result.item);
  }, [searchText, pages, fuse]);

  async function fetchPages() {
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
            [:find (pull ?p [:block/uuid :block/name])
             :where
             [?p :block/name]]
          `,
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (Array.isArray(data)) {
        const fetchedPages = await Promise.all(
          data.map(async (item) => {
            const page = item[0];
            const content = await fetchPageContent(page.uuid);
            return {
              id: page.uuid,
              name: page.name,
              content: content,
            };
          })
        );
        setPages(fetchedPages);
      }
    } catch (error) {
      console.error("Error fetching pages:", error);
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to fetch pages",
        message: "Please check your Logseq API connection",
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchPageContent(pageId: string): Promise<string> {
    try {
      const response = await fetch(preferences.logseqApiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${preferences.logseqApiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          method: "logseq.Editor.getPageBlocksTree",
          args: [pageId],
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();

      if (Array.isArray(result)) {
        return result.map(block => extractContent(block)).join("\n");
      } else if (typeof result === "object" && result !== null) {
        return extractContent(result as Block);
      } else {
        return "No content available";
      }
    } catch (error) {
      console.error("Error fetching page content:", error);
      return "Failed to load page content";
    }
  }

  function extractContent(block: Block): string {
    let content = block.content ? block.content.replace(/\s*id::\s*[a-f0-9-]+/g, "").trim() : "";
    if (Array.isArray(block.children)) {
      content += "\n" + block.children.map((child: Block) => extractContent(child)).join("\n");
    }
    return content;
  }

  async function openInLogseq(page: Page) {
    try {
      const graphName = encodeURIComponent(preferences.logseqGraphName);
      const pageName = encodeURIComponent(page.name);
      await open(`logseq://graph/${graphName}?page=${pageName}`);
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
      searchBarPlaceholder="Search Logseq pages... (type at least 2 characters)"
      throttle
      isShowingDetail
    >
      {searchText.length <= 1 ? (
        <List.EmptyView icon={Icon.MagnifyingGlass} title="Enter at least 2 characters to search" />
      ) : (
        filteredPages.map((page) => (
          <List.Item
            key={`${page.id}-${page.name}`}
            title={page.name}
            actions={
              <ActionPanel>
                <Action title="Open in Logseq" icon={Icon.ArrowRight} onAction={() => openInLogseq(page)} />
                <Action.CopyToClipboard
                  title="Copy Page Name"
                  content={page.name}
                  shortcut={{ modifiers: ["cmd"], key: "c" }}
                />
                <Action.CopyToClipboard
                  title="Copy Page Content"
                  content={cleanContent(page.content)}
                  shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
                />
              </ActionPanel>
            }
            detail={
              <List.Item.Detail
                markdown={cleanContent(page.content)}
              />
            }
          />
        ))
      )}
    </List>
  );
}
