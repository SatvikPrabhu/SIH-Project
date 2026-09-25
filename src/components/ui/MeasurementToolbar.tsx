"use client";

import { motion } from "framer-motion";
import { Box, Download, Mountain, Ruler, Spline } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { GisExportFormat, MeasurementTool, VizMode } from "@/types/dashboard";

export type MeasurementToolbarProps = {
  activeTool: MeasurementTool | null;
  vizMode: VizMode;
  onToolChange: (tool: MeasurementTool) => void;
  onVizModeChange: (mode: VizMode) => void;
  onExport: (format: GisExportFormat) => void;
};

const TOOLS: Array<{
  id: MeasurementTool;
  label: string;
  hint: string;
  icon: typeof Ruler;
}> = [
  { id: "distance", label: "Distance", hint: "Linear measurement", icon: Ruler },
  { id: "height", label: "Height", hint: "Vertical clearance", icon: Mountain },
  { id: "area", label: "Area", hint: "2D surface footprint", icon: Spline },
];

export function MeasurementToolbar({
  activeTool,
  vizMode,
  onToolChange,
  onVizModeChange,
  onExport,
}: MeasurementToolbarProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
      className="pointer-events-none absolute bottom-6 left-1/2 z-50 -translate-x-1/2"
    >
      <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-slate-800 bg-slate-900/80 px-3 py-2 shadow-2xl backdrop-blur-md">
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          const active = activeTool === tool.id;
          return (
            <Tooltip key={tool.id}>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={tool.label}
                  onClick={() => onToolChange(tool.id)}
                  className={cn(
                    "rounded-full",
                    active && "bg-blue-500/20 text-blue-300 hover:bg-blue-500/25",
                  )}
                >
                  <Icon />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {tool.label} · {tool.hint}
              </TooltipContent>
            </Tooltip>
          );
        })}

        <span className="mx-1 h-5 w-px bg-slate-700" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                onVizModeChange(vizMode === "mesh" ? "pointcloud" : "mesh")
              }
              className="rounded-full px-3 font-mono text-[10px] tracking-widest uppercase"
            >
              <Box />
              {vizMode === "mesh" ? "Mesh" : "Cloud"}
            </Button>
          </TooltipTrigger>
          <TooltipContent>3D Mesh / Point Cloud toggle</TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="rounded-full px-3 font-mono text-[10px] tracking-widest uppercase"
                >
                  <Download />
                  GIS
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>Export GIS</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="center" side="top">
            <DropdownMenuItem onSelect={() => onExport("3dtiles")}>
              .3dtiles
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onExport("las")}>.las</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onExport("obj")}>.obj</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onExport("tiff")}>.tiff</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.div>
  );
}
