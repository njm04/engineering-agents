import { deploy, parseArgs } from "./deployment.js";

deploy(parseArgs(process.argv.slice(2), "install"), "install");
