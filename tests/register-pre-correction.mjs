import { register } from "node:module";

register("./typescript-loader.mjs", import.meta.url);
register("./pre-correction-loader.mjs", import.meta.url);
