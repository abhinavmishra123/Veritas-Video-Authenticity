import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const VeritasRegistryModule = buildModule("VeritasRegistryModule", (m) => {
  const registry = m.contract("VeritasRegistry", []);
  return { registry };
});

export default VeritasRegistryModule;
