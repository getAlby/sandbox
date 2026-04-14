import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useScenarioStore, useWalletStore, useUIStore } from "@/stores";
import { AlertCircle, Code, Lightbulb, X } from "lucide-react";
import { useState } from "react";

export function ScenarioInfo() {
  const { currentScenario } = useScenarioStore();
  const { areAllWalletsConnected } = useWalletStore();

  const [learnOpen, setLearnOpen] = useState(false);
  const requiredWallets = currentScenario.requiredWallets || [];
  const allConnected = areAllWalletsConnected(requiredWallets);
  const hasSnippets =
    currentScenario.snippetIds && currentScenario.snippetIds.length > 0;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{currentScenario.icon}</span>
          <h2 className="text-xl font-semibold">{currentScenario.title}</h2>
          <ComplexityBadge complexity={currentScenario.complexity} />
        </div>
        <p className="text-muted-foreground">
          {currentScenario.description}
          <div className="flex sm:inline-flex items-center gap-2 mt-2 sm:mt-0 sm:translate-y-0.5 sm:ml-2 sm:gap-2">
            <Popover open={learnOpen} onOpenChange={setLearnOpen}>
              <PopoverTrigger asChild>
                <button
                  className="inline-flex items-center justify-center rounded-full bg-yellow-500/20 p-1 text-yellow-600 hover:bg-yellow-500/30 dark:text-yellow-400 dark:hover:bg-yellow-500/40 transition-colors"
                  aria-label="Learn more"
                >
                  <Lightbulb className="h-4 w-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80 text-sm">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Learn</h4>
                    <button
                      onClick={() => setLearnOpen(false)}
                      className="rounded-sm opacity-70 hover:opacity-100 transition-opacity"
                      aria-label="Close"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="text-muted-foreground">
                    {currentScenario.education}
                  </p>
                  {currentScenario.howItWorks &&
                    currentScenario.howItWorks.length > 0 && (
                      <div className="border-t pt-3">
                        <h5 className="mb-2 font-medium">How it works</h5>
                        <ol className="list-decimal space-y-1.5 pl-4 text-muted-foreground">
                          {currentScenario.howItWorks.map((step, i) => (
                            <li key={i}>
                              <span className="font-medium text-foreground">
                                {step.title}
                              </span>{" "}
                              — {step.description}
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                  {currentScenario.links &&
                    currentScenario.links.length > 0 && (
                      <div className="border-t pt-3">
                        <h5 className="mb-2 font-medium">Learn more</h5>
                        <ul className="space-y-1">
                          {currentScenario.links.map((link, i) => (
                            <li key={i}>
                              <a
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline dark:text-blue-400 text-xs"
                              >
                                {link.label}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                </div>
              </PopoverContent>
            </Popover>
            {hasSnippets && (
              <button
                className="inline-flex items-center justify-center rounded-full bg-blue-500/20 p-1 text-blue-600 hover:bg-blue-500/30 dark:text-blue-400 dark:hover:bg-blue-500/40 transition-colors"
                aria-label="View code snippets"
                onClick={() => {
                  const store = useUIStore.getState();
                  store.setSnippetCategory("this-scenario");
                  store.setVisualizationTab("snippets");
                  setTimeout(() => {
                    document
                      .getElementById("visualization-panel")
                      ?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      });
                  }, 100);
                }}
              >
                <Code className="h-4 w-4" />
              </button>
            )}
          </div>
        </p>
      </div>

      {requiredWallets.length > 0 && !allConnected && (
        <Alert
          variant="default"
          className="border-yellow-500/50 bg-yellow-500/10"
        >
          <AlertCircle className="h-4 w-4 text-yellow-500" />
          <AlertDescription className="text-yellow-700 dark:text-yellow-300">
            Connect all required wallets to start this scenario
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function ComplexityBadge({ complexity }: { complexity: string }) {
  const variants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
    simplest: "default",
    simple: "default",
    medium: "secondary",
    advanced: "outline",
    expert: "destructive",
  };

  return (
    <Badge variant={variants[complexity] || "outline"} className="text-xs">
      {complexity}
    </Badge>
  );
}

