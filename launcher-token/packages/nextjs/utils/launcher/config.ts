import { isAddress, keccak256, stringToHex } from "viem";
import scaffoldConfig from "~~/scaffold.config";

export const network = scaffoldConfig.targetNetworks[0];
export const factoryAddress = process.env.NEXT_PUBLIC_TOKEN_FACTORY;
export const configured =
  !!factoryAddress && isAddress(factoryAddress) && factoryAddress !== "0x0000000000000000000000000000000000000000";
export const proposalId = keccak256(stringToHex("fictional-test-launcher-v1"));
export const revision = keccak256(stringToHex("fictional-test-launcher-disclosures-v1"));
export const fixtureName = "Fictional Test Launcher";
export const fixtureSymbol = "FTEST";
