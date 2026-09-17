import { browser } from "$app/environment";

export const ssr = !browser;
export const prerender = false;
