-- Sticker pack completion writes 16 paths into photoshoot_tile_paths.
-- SQL 270 taught landing_complete_generation to accept 4 or 16, but the table
-- check from SQL 225 stayed `cardinality = 4`, so the UPDATE failed with
-- landing_generations_photoshoot_tile_paths_len and the job was refunded.

ALTER TABLE public.landing_generations
  DROP CONSTRAINT IF EXISTS landing_generations_photoshoot_tile_paths_len,
  ADD CONSTRAINT landing_generations_photoshoot_tile_paths_len
    CHECK (
      photoshoot_tile_paths IS NULL
      OR cardinality(photoshoot_tile_paths) IN (4, 16)
    );

COMMENT ON COLUMN public.landing_generations.photoshoot_tile_paths IS
  'Photoshoot: 4 JPEG sidecars. Sticker pack: 16 PNG sidecars. NULL if the split was skipped.';
