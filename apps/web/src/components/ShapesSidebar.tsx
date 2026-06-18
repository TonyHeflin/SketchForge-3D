"use client";

import { ChevronDown, Search } from "lucide-react";
import { useState } from "react";
import { NotesToolIcon, WorkplaneToolIcon } from "./icons";
import type { ShapeAsset } from "@/types/sketchforge";

const categories = [
  "Your Creations",
  "Favorites",
  "Basic Shapes",
  "Letters & Numbers",
  "Design Starters",
  "Creatures & Characters",
  "Vehicles & Machines",
  "Structures & Scenery",
  "Hardware",
  "Electronics",
  "Fun & Games",
  "Everyday Objects",
  "Featured Collections",
  "Sim Lab",
  "Shape Generators",
];

const shapes: ShapeAsset[] = [
  { id: "box-hole", name: "Box", src: "assets/sketchforge/box-hole.png", kind: "box", color: "#b8c2cc", hole: true },
  { id: "cylinder-hole", name: "Cylinder", src: "assets/sketchforge/cylinder-hole.png", kind: "cylinder", color: "#b8c2cc", hole: true },
  { id: "sphere-hole", name: "Sphere", src: "assets/sketchforge/sphere-hole.png", kind: "sphere", color: "#b8c2cc", hole: true },
  { id: "box-red", name: "Box", src: "assets/sketchforge/box-red.png", kind: "box", color: "#d41721" },
  { id: "cylinder-orange", name: "Cylinder", src: "assets/sketchforge/cylinder-orange.png", kind: "cylinder", color: "#d97813" },
  { id: "sphere-blue", name: "Sphere", src: "assets/sketchforge/sphere-blue.png", kind: "sphere", color: "#0098c7" },
  { id: "cone-purple", name: "Cone", src: "assets/sketchforge/cone-purple.png", kind: "cone", color: "#6e2786" },
  { id: "pyramid-yellow", name: "Pyramid", src: "assets/sketchforge/pyramid-yellow.png", kind: "pyramid", color: "#f2cf10" },
  { id: "roof-green", name: "Roof", src: "assets/sketchforge/roof-green.png", kind: "roof", color: "#33983d" },
  { id: "text-red", name: "Text", src: "assets/sketchforge/text-red.png", kind: "text", color: "#cf101b" },
  { id: "round-roof-cyan", name: "Round Roof", src: "assets/sketchforge/round-roof-cyan.png", kind: "roundRoof", color: "#67c4ce" },
  { id: "half-sphere-pink", name: "Half Sphere", src: "assets/sketchforge/half-sphere-pink.png", kind: "halfSphere", color: "#c9009a" },
  { id: "torus-blue", name: "Torus", src: "assets/sketchforge/torus-blue.png", kind: "torus", color: "#0098c7" },
  { id: "tube-orange", name: "Tube", src: "assets/sketchforge/tube-orange.png", kind: "tube", color: "#ce7013" },
  { id: "ring-brown", name: "Ring", src: "assets/sketchforge/ring-brown.png", kind: "ring", color: "#8a5a2b" },
];

type ShapesSidebarProps = {
  onAddShape: (shape: ShapeAsset) => void;
};

export function ShapesSidebar({ onAddShape }: ShapesSidebarProps) {
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <aside className="shapes-sidebar" aria-label="Shapes Library">
      <div className="sidebar-tools">
        <button className="sidebar-tool" aria-label="Workplane">
          <WorkplaneToolIcon />
        </button>
        <button className="sidebar-tool" aria-label="Notes">
          <NotesToolIcon />
        </button>
      </div>

      <div className="category-row">
        <button className="category-button" onClick={() => setCategoryOpen((value) => !value)}>
          <span>{searchOpen ? "Basic Shapes" : "Basic Shapes"}</span>
          <ChevronDown size={17} strokeWidth={3} />
        </button>
        <button className="search-button" onClick={() => setSearchOpen((value) => !value)} aria-label="Search shapes">
          <Search size={30} strokeWidth={2.3} />
        </button>
      </div>

      {searchOpen ? (
        <div className="sidebar-search">
          <Search size={19} />
          <input autoFocus placeholder="Search shapes" />
        </div>
      ) : null}

      {categoryOpen ? (
        <div className="category-menu">
          {categories.map((category) => (
            <button key={category} className={category === "Basic Shapes" ? "selected" : ""}>
              {category}
            </button>
          ))}
        </div>
      ) : null}

      <div className="shape-scroll">
        <div className="shape-grid">
          {shapes.map((shape) => (
            <button
              className="shape-tile"
              draggable
              key={shape.id}
              title={`${shape.name}: drag or click to place`}
              onClick={() => onAddShape(shape)}
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "copy";
                event.dataTransfer.setData("application/x-sketchforge-shape", JSON.stringify(shape));
              }}
            >
              <img src={shape.src} alt="" draggable={false} />
            </button>
          ))}
        </div>
        <button className="more-shapes">More Shapes</button>
      </div>
    </aside>
  );
}
