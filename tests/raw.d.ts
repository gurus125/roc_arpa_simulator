/** Files read as text in the tests (`import text from "../docs/X.md?raw"`), as vitest allows. */
declare module "*?raw" {
  const text: string;
  export default text;
}
