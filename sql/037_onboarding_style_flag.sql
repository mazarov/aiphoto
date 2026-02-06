-- Add show_in_onboarding flag to style_groups
-- Controls which style groups are visible during user onboarding (first 2 stickers)

ALTER TABLE style_groups 
ADD COLUMN IF NOT EXISTS show_in_onboarding boolean DEFAULT true;

-- By default all groups are shown in onboarding
-- To hide a group during onboarding:
-- UPDATE style_groups SET show_in_onboarding = false WHERE id = 'russian';

COMMENT ON COLUMN style_groups.show_in_onboarding IS 'If false, group is hidden for users with onboarding_step < 2';
