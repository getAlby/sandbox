import type { SnippetId } from "@/data/code-snippets";

export type ScenarioComplexity = "simplest" | "simple" | "medium" | "advanced" | "expert";

export type ScenarioSection = "scenarios" | "402" | "bitcoin-connect";

export interface ScenarioPrompt {
  title: string;
  description: string;
  prompt: string;
}

export interface Scenario {
  id: string;
  title: string;
  description: string;
  education: string;
  icon: string;
  complexity: ScenarioComplexity;
  section?: ScenarioSection;
  requiredWallets?: string[];
  howItWorks?: { title: string; description: string }[];
  links?: { label: string; url: string }[];
  prompts?: ScenarioPrompt[];
  snippetIds?: SnippetId[];
}
