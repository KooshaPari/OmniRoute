"use client";

import DebugModeCard from "../components/DebugModeCard";
import IssueAgentSettingsCard from "../components/IssueAgentSettingsCard";
import LogToolSourcesCard from "../components/LogToolSourcesCard";
import PayloadRulesTab from "../components/PayloadRulesTab";
import RequestLimitsTab from "../components/RequestLimitsTab";
import CliproxyapiSettingsTab from "../components/CliproxyapiSettingsTab";

export default function SettingsAdvancedPage() {
  return (
    <div className="space-y-6">
      <DebugModeCard />
      <IssueAgentSettingsCard />
      <LogToolSourcesCard />
      <PayloadRulesTab />
      <RequestLimitsTab />
      <CliproxyapiSettingsTab />
    </div>
  );
}
