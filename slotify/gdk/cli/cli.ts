#!/usr/bin/env node
import {program} from "commander";
import * as packageJson from "./../package.json";

program
    .name("slotify")
    .version(packageJson.version)
    .usage("[command] [options]")
    .command("stats", "Simulation engine (single-player games)", {executableFile: "stats"})
    .command("stats-multiplayer", "Simulation engine (multi-player games)", {executableFile: "stats-multiplayer"})
    .command("dump", "Dump rounds", {executableFile: "dump"})
    .command("gati", "GATI management", {executableFile: "gati"});

program.parse(process.argv);
