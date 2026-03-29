import { Platform, StyleSheet } from "react-native";
import Markdown from "react-native-markdown-display";
import { useColorScheme } from "nativewind";
import { Colors } from "@/constants/colors";

type MarkdownTextProps = {
  children: string;
  style?: Record<string, object>;
};

/**
 * Shared markdown rendering component styled to match the app's design system.
 *
 * Uses `react-native-markdown-display` under the hood. Pass raw markdown as
 * the `children` prop. An optional `style` prop (keyed by markdown element
 * name) is deep-merged with the defaults via `mergeStyle`.
 *
 * Automatically switches between light and dark styles based on the current
 * color scheme.
 */
export function MarkdownText({ children, style }: MarkdownTextProps) {
  if (!children) return null;

  const { colorScheme } = useColorScheme();
  const defaultStyle = colorScheme === "dark" ? darkMarkdownStyles : markdownStyles;

  return (
    <Markdown style={style ?? defaultStyle} mergeStyle={!!style}>
      {children}
    </Markdown>
  );
}

/**
 * Pre-built style overrides that map the library's default look to the PRM
 * design tokens.  Import and spread into the `style` prop when you need the
 * branded look (most call-sites will want this).
 *
 * Usage:
 *   <MarkdownText style={markdownStyles}>{text}</MarkdownText>
 */
export const markdownStyles = StyleSheet.create({
  // Container
  body: {
    color: Colors.gray[900], // stone-900
    fontSize: 16, // text-base
    lineHeight: 24,
  },

  // Headings
  heading1: {
    color: Colors.gray[900],
    fontSize: 24,
    fontWeight: "700",
    marginTop: 16,
    marginBottom: 8,
    flexDirection: "row",
  },
  heading2: {
    color: Colors.gray[900],
    fontSize: 20,
    fontWeight: "700",
    marginTop: 14,
    marginBottom: 6,
    flexDirection: "row",
  },
  heading3: {
    color: Colors.gray[900],
    fontSize: 18,
    fontWeight: "600",
    marginTop: 12,
    marginBottom: 4,
    flexDirection: "row",
  },
  heading4: {
    color: Colors.gray[800],
    fontSize: 16,
    fontWeight: "600",
    marginTop: 10,
    marginBottom: 4,
    flexDirection: "row",
  },
  heading5: {
    color: Colors.gray[800],
    fontSize: 14,
    fontWeight: "600",
    marginTop: 8,
    marginBottom: 2,
    flexDirection: "row",
  },
  heading6: {
    color: Colors.gray[700],
    fontSize: 13,
    fontWeight: "600",
    marginTop: 8,
    marginBottom: 2,
    flexDirection: "row",
  },

  // Paragraph
  paragraph: {
    marginTop: 4,
    marginBottom: 4,
    flexWrap: "wrap",
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "flex-start",
    width: "100%",
  },

  // Emphasis
  strong: {
    fontWeight: "700",
    color: Colors.gray[900],
  },
  em: {
    fontStyle: "italic",
  },
  s: {
    textDecorationLine: "line-through",
    color: Colors.gray[500],
  },

  // Links
  link: {
    color: Colors.brand[600], // indigo-600
    textDecorationLine: "none",
  },

  // Blockquotes
  blockquote: {
    backgroundColor: Colors.gray[50],
    borderColor: Colors.brand[300],
    borderLeftWidth: 3,
    marginLeft: 0,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 4,
    marginBottom: 4,
    borderRadius: 4,
  },

  // Inline code
  code_inline: {
    backgroundColor: Colors.gray[100], // stone-100
    borderWidth: 0,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontSize: 14,
    color: Colors.gray[800],
    ...Platform.select({
      ios: { fontFamily: "Menlo" },
      android: { fontFamily: "monospace" },
      default: { fontFamily: "monospace" },
    }),
  },

  // Fenced code blocks
  code_block: {
    backgroundColor: Colors.gray[100],
    borderWidth: 0,
    borderRadius: 8,
    padding: 12,
    fontSize: 13,
    lineHeight: 20,
    color: Colors.gray[800],
    ...Platform.select({
      ios: { fontFamily: "Menlo" },
      android: { fontFamily: "monospace" },
      default: { fontFamily: "monospace" },
    }),
  },
  fence: {
    backgroundColor: Colors.gray[100],
    borderWidth: 0,
    borderRadius: 8,
    padding: 12,
    fontSize: 13,
    lineHeight: 20,
    color: Colors.gray[800],
    ...Platform.select({
      ios: { fontFamily: "Menlo" },
      android: { fontFamily: "monospace" },
      default: { fontFamily: "monospace" },
    }),
  },

  // Lists
  bullet_list: {},
  ordered_list: {},
  list_item: {
    flexDirection: "row",
    justifyContent: "flex-start",
    marginTop: 2,
    marginBottom: 2,
  },
  bullet_list_icon: {
    marginLeft: 4,
    marginRight: 8,
    color: Colors.gray[500],
  },
  bullet_list_content: {
    flex: 1,
  },
  ordered_list_icon: {
    marginLeft: 4,
    marginRight: 8,
    color: Colors.gray[500],
  },
  ordered_list_content: {
    flex: 1,
  },

  // Tables
  table: {
    borderWidth: 1,
    borderColor: Colors.gray[200],
    borderRadius: 8,
    overflow: "hidden",
  },
  thead: {
    backgroundColor: Colors.gray[50],
  },
  th: {
    flex: 1,
    padding: 8,
    fontWeight: "600",
    color: Colors.gray[700],
  },
  tr: {
    borderBottomWidth: 1,
    borderColor: Colors.gray[200],
    flexDirection: "row",
  },
  td: {
    flex: 1,
    padding: 8,
    color: Colors.gray[900],
  },

  // Horizontal rule
  hr: {
    backgroundColor: Colors.gray[200],
    height: 1,
    marginTop: 12,
    marginBottom: 12,
  },

  // Text
  text: {
    color: Colors.gray[900],
  },

  // Images
  image: {
    borderRadius: 8,
  },
});

/**
 * Dark mode style overrides for markdown rendering.
 * Uses light text on dark backgrounds.
 */
export const darkMarkdownStyles = StyleSheet.create({
  // Container
  body: {
    color: "#e7e5e4", // stone-200
    fontSize: 16,
    lineHeight: 24,
  },

  // Headings
  heading1: {
    color: "#f5f5f4", // stone-100
    fontSize: 24,
    fontWeight: "700",
    marginTop: 16,
    marginBottom: 8,
    flexDirection: "row",
  },
  heading2: {
    color: "#f5f5f4",
    fontSize: 20,
    fontWeight: "700",
    marginTop: 14,
    marginBottom: 6,
    flexDirection: "row",
  },
  heading3: {
    color: "#f5f5f4",
    fontSize: 18,
    fontWeight: "600",
    marginTop: 12,
    marginBottom: 4,
    flexDirection: "row",
  },
  heading4: {
    color: "#e7e5e4", // stone-200
    fontSize: 16,
    fontWeight: "600",
    marginTop: 10,
    marginBottom: 4,
    flexDirection: "row",
  },
  heading5: {
    color: "#e7e5e4",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 8,
    marginBottom: 2,
    flexDirection: "row",
  },
  heading6: {
    color: "#d6d3d1", // stone-300
    fontSize: 13,
    fontWeight: "600",
    marginTop: 8,
    marginBottom: 2,
    flexDirection: "row",
  },

  // Paragraph
  paragraph: {
    marginTop: 4,
    marginBottom: 4,
    flexWrap: "wrap",
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "flex-start",
    width: "100%",
  },

  // Emphasis
  strong: {
    fontWeight: "700",
    color: "#f5f5f4", // stone-100
  },
  em: {
    fontStyle: "italic",
  },
  s: {
    textDecorationLine: "line-through",
    color: "#a8a29e", // stone-400
  },

  // Links
  link: {
    color: "#818cf8", // indigo-400
    textDecorationLine: "none",
  },

  // Blockquotes
  blockquote: {
    backgroundColor: "#292524", // stone-800
    borderColor: "#6366f1", // indigo-500
    borderLeftWidth: 3,
    marginLeft: 0,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 4,
    marginBottom: 4,
    borderRadius: 4,
  },

  // Inline code
  code_inline: {
    backgroundColor: "#292524", // stone-800
    borderWidth: 0,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontSize: 14,
    color: "#e7e5e4", // stone-200
    ...Platform.select({
      ios: { fontFamily: "Menlo" },
      android: { fontFamily: "monospace" },
      default: { fontFamily: "monospace" },
    }),
  },

  // Fenced code blocks
  code_block: {
    backgroundColor: "#292524", // stone-800
    borderWidth: 0,
    borderRadius: 8,
    padding: 12,
    fontSize: 13,
    lineHeight: 20,
    color: "#e7e5e4", // stone-200
    ...Platform.select({
      ios: { fontFamily: "Menlo" },
      android: { fontFamily: "monospace" },
      default: { fontFamily: "monospace" },
    }),
  },
  fence: {
    backgroundColor: "#292524", // stone-800
    borderWidth: 0,
    borderRadius: 8,
    padding: 12,
    fontSize: 13,
    lineHeight: 20,
    color: "#e7e5e4", // stone-200
    ...Platform.select({
      ios: { fontFamily: "Menlo" },
      android: { fontFamily: "monospace" },
      default: { fontFamily: "monospace" },
    }),
  },

  // Lists
  bullet_list: {},
  ordered_list: {},
  list_item: {
    flexDirection: "row",
    justifyContent: "flex-start",
    marginTop: 2,
    marginBottom: 2,
  },
  bullet_list_icon: {
    marginLeft: 4,
    marginRight: 8,
    color: "#a8a29e", // stone-400
  },
  bullet_list_content: {
    flex: 1,
  },
  ordered_list_icon: {
    marginLeft: 4,
    marginRight: 8,
    color: "#a8a29e", // stone-400
  },
  ordered_list_content: {
    flex: 1,
  },

  // Tables
  table: {
    borderWidth: 1,
    borderColor: "#44403c", // stone-700
    borderRadius: 8,
    overflow: "hidden",
  },
  thead: {
    backgroundColor: "#292524", // stone-800
  },
  th: {
    flex: 1,
    padding: 8,
    fontWeight: "600",
    color: "#d6d3d1", // stone-300
  },
  tr: {
    borderBottomWidth: 1,
    borderColor: "#44403c", // stone-700
    flexDirection: "row",
  },
  td: {
    flex: 1,
    padding: 8,
    color: "#e7e5e4", // stone-200
  },

  // Horizontal rule
  hr: {
    backgroundColor: "#44403c", // stone-700
    height: 1,
    marginTop: 12,
    marginBottom: 12,
  },

  // Text
  text: {
    color: "#e7e5e4", // stone-200
  },

  // Images
  image: {
    borderRadius: 8,
  },
});
