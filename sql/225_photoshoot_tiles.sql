-- Sidecar JPEG paths for the four 2x2 photoshoot tiles.
-- Sheet remains landing_generations.result_storage_path.

ALTER TABLE public.landing_generations
  ADD COLUMN IF NOT EXISTS photoshoot_tile_paths text[];

ALTER TABLE public.landing_generations
  DROP CONSTRAINT IF EXISTS landing_generations_photoshoot_tile_paths_len,
  ADD CONSTRAINT landing_generations_photoshoot_tile_paths_len
    CHECK (
      photoshoot_tile_paths IS NULL
      OR cardinality(photoshoot_tile_paths) = 4
    );

COMMENT ON COLUMN public.landing_generations.photoshoot_tile_paths IS
  'Worker-cut 2x2 tiles: four storage paths next to the sheet. NULL if split skipped or failed.';
