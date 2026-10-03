import { mount } from "svelte";
import "./app.css";
import App from "./App.svelte";

// After a new deploy, an open tab may ask for code files that no longer exist. Reload once to
// pick up the new build instead of showing a blank page.
window.addEventListener("vite:preloadError", (event) => {
  if (sessionStorage.getItem("reloaded-for-new-build")) return;
  sessionStorage.setItem("reloaded-for-new-build", "1");
  event.preventDefault();
  location.reload();
});
window.addEventListener("load", () => sessionStorage.removeItem("reloaded-for-new-build"));

const target = document.getElementById("app");
if (!target) throw new Error("Missing #app element");

mount(App, { target });
