import type { CheckpointConfig } from "../tasks/types.js";

export interface TaskTemplate {
  title: string;
  description: string;
  checkpoints: CheckpointConfig[];
  escrow_lamports: number;
  payout_cents: number;
  max_duration_seconds?: number;
}

export const TASK_CATALOG: Record<string, TaskTemplate[]> = {
  HomeBot: [
    {
      title: "Wash the Dishes",
      description: "Clean all dishes in the sink until the sink is empty and dishes are on the drying rack.",
      escrow_lamports: 500_000_000,
      payout_cents: 500,
      checkpoints: [
        { type: "object", target: "Is someone washing dishes at a kitchen sink?" },
        { type: "object", target: "Is the kitchen sink empty with clean dishes on a drying rack?" },
      ],
    },
    {
      title: "Vacuum the Living Room",
      description: "Vacuum the entire living room floor including under furniture edges.",
      escrow_lamports: 400_000_000,
      payout_cents: 400,
      checkpoints: [
        { type: "object", target: "Is someone using a vacuum cleaner on a carpet or floor?" },
        { type: "object", target: "Is the living room floor clean and vacuum-free with the vacuum put away?" },
      ],
    },
    {
      title: "Take Out the Trash",
      description: "Remove all trash bags from the kitchen bin and take them to the outdoor bin.",
      escrow_lamports: 300_000_000,
      payout_cents: 300,
      checkpoints: [
        { type: "object", target: "Is someone carrying a trash bag?" },
        { type: "location", target: "Is the person at an outdoor trash or recycling bin area?" },
      ],
    },
    {
      title: "Clean the Bathroom",
      description: "Scrub the bathroom sink, toilet, and mirror until spotless.",
      escrow_lamports: 600_000_000,
      payout_cents: 600,
      checkpoints: [
        { type: "object", target: "Is someone scrubbing or cleaning a bathroom sink or toilet?" },
        { type: "object", target: "Is a clean bathroom visible with a sparkling mirror and tidy countertop?" },
      ],
    },
  ],

  BakeAssist: [
    {
      title: "Bake Chocolate Chip Cookies",
      description: "Bake a batch of chocolate chip cookies from scratch.",
      escrow_lamports: 800_000_000,
      payout_cents: 800,
      checkpoints: [
        { type: "object", target: "Is someone mixing cookie dough or batter in a bowl?" },
        { type: "object", target: "Is someone placing a baking tray with cookies into an oven?" },
        { type: "object", target: "Are freshly baked cookies visible on a cooling rack or tray?" },
      ],
    },
    {
      title: "Make Sourdough Bread",
      description: "Shape and bake a loaf of sourdough bread.",
      escrow_lamports: 900_000_000,
      payout_cents: 900,
      checkpoints: [
        { type: "object", target: "Is someone kneading or shaping bread dough on a floured surface?" },
        { type: "object", target: "Is a baked loaf of bread visible with a golden crust?" },
      ],
    },
    {
      title: "Decorate a Cake",
      description: "Frost and decorate a cake with icing and toppings.",
      escrow_lamports: 700_000_000,
      payout_cents: 700,
      checkpoints: [
        { type: "object", target: "Is someone applying frosting or icing to a cake?" },
        { type: "object", target: "Is a fully decorated cake visible with toppings or decorations?" },
      ],
    },
  ],

  TidyUp: [
    {
      title: "Organize a Bookshelf",
      description: "Arrange books neatly on a bookshelf, grouped and upright.",
      escrow_lamports: 450_000_000,
      payout_cents: 450,
      checkpoints: [
        { type: "object", target: "Is someone removing books from a messy or disorganized shelf?" },
        { type: "object", target: "Are books arranged upright and grouped neatly on a bookshelf?" },
      ],
    },
    {
      title: "Sort and Fold Laundry",
      description: "Sort laundry by type and fold everything neatly.",
      escrow_lamports: 400_000_000,
      payout_cents: 400,
      checkpoints: [
        { type: "object", target: "Is someone sorting laundry into separate piles by color or type?" },
        { type: "object", target: "Are neatly folded clothes visible in organized stacks?" },
      ],
    },
    {
      title: "Declutter a Desk",
      description: "Clear and organize a messy desk surface.",
      escrow_lamports: 350_000_000,
      payout_cents: 350,
      checkpoints: [
        { type: "object", target: "Is someone clearing papers, items, or clutter from a desk?" },
        { type: "object", target: "Is a clean, organized desk visible with items neatly arranged?" },
      ],
    },
  ],

  ChefBot: [
    {
      title: "Cook a Stir-Fry",
      description: "Prepare and cook a vegetable stir-fry from scratch.",
      escrow_lamports: 600_000_000,
      payout_cents: 600,
      checkpoints: [
        { type: "object", target: "Is someone chopping or preparing ingredients on a cutting board?" },
        { type: "object", target: "Is food being cooked in a wok or pan on a stovetop?" },
      ],
    },
    {
      title: "Make a Salad",
      description: "Prepare a fresh salad with at least 4 ingredients.",
      escrow_lamports: 350_000_000,
      payout_cents: 350,
      checkpoints: [
        { type: "object", target: "Is someone washing or chopping fresh vegetables or greens?" },
        { type: "object", target: "Is a prepared salad bowl visible with mixed ingredients?" },
      ],
    },
    {
      title: "Prepare a Smoothie",
      description: "Blend a fresh fruit smoothie with visible ingredients.",
      escrow_lamports: 300_000_000,
      payout_cents: 300,
      checkpoints: [
        { type: "object", target: "Are fresh fruits or ingredients visible near a blender?" },
        { type: "object", target: "Is a blended smoothie visible in a glass or cup?" },
      ],
    },
  ],

  DataBot: [
    {
      title: "Complete Data Entry Form",
      description: "Fill out a structured data form on a computer with all required fields.",
      escrow_lamports: 300_000_000,
      payout_cents: 300,
      checkpoints: [
        { type: "object", target: "Is someone typing data into a spreadsheet or form on a computer screen?" },
        { type: "document", target: "Is a completed form or spreadsheet visible with all fields filled in?" },
      ],
    },
    {
      title: "Scan and File Documents",
      description: "Scan physical documents and organize them digitally.",
      escrow_lamports: 400_000_000,
      payout_cents: 400,
      checkpoints: [
        { type: "object", target: "Is someone placing a document on a scanner or taking a photo of it?" },
        { type: "document", target: "Is a scanned document visible on a computer screen?" },
      ],
    },
    {
      title: "Update a Spreadsheet",
      description: "Add new rows of data to an existing spreadsheet.",
      escrow_lamports: 250_000_000,
      payout_cents: 250,
      checkpoints: [
        { type: "object", target: "Is someone viewing a spreadsheet with multiple rows on a computer?" },
        { type: "document", target: "Is an updated spreadsheet visible with new data entries highlighted or added?" },
      ],
    },
  ],

  ErrandBot: [
    {
      title: "Pick Up a Package",
      description: "Go to the designated pickup location and collect the package. Show the receipt.",
      escrow_lamports: 750_000_000,
      payout_cents: 750,
      checkpoints: [
        { type: "location", target: "Is the person at a store, post office, or pickup counter?" },
        { type: "object", target: "Is the person holding a package or parcel?" },
        { type: "document", target: "Is a receipt or proof of pickup visible?" },
      ],
    },
    {
      title: "Deliver Groceries",
      description: "Pick up groceries from a store and deliver them to the specified address.",
      escrow_lamports: 850_000_000,
      payout_cents: 850,
      checkpoints: [
        { type: "location", target: "Is the person inside a grocery store or supermarket?" },
        { type: "object", target: "Is the person carrying grocery bags?" },
        { type: "document", target: "Is a grocery receipt visible?" },
      ],
    },
    {
      title: "Return Library Books",
      description: "Return books to the local library and get confirmation.",
      escrow_lamports: 400_000_000,
      payout_cents: 400,
      checkpoints: [
        { type: "location", target: "Is the person at a library entrance or return desk?" },
        { type: "object", target: "Is the person holding books near a library return slot or desk?" },
      ],
    },
  ],
};
