# Hourfall

An open-world RPG by City Apps. The sun stopped nine days ago; you carry the only thing still keeping time.

**Play:** https://zachyj7.github.io/city-apps/hourfall/ (phone, tablet or desktop browser; add to home screen for full screen)

**Run locally:** `python hourfall/scripts/serve.py` then open http://localhost:8131

## What is in it

- A continent about 7 km across, streamed in chunks: castle city (Highmark), nine regional cities, hamlets, boss arenas.
- Regions by difficulty: Dawnmere Vale, Crownlands, Salt Coast, Verdance, Glass Wastes, Highcrags, Frostspine, Galeheath and the sky-city, the Drowned Reach, the Cinderdeep.
- Ring combat built on Pivot: strike zones, parries and ripostes, three-centre-hit Finishers, Flow, glyphs, gadgets, skills, legendary items that change the ring.
- Main story through all nine countries, three endings, side quests, Lost Minutes, journal pages, Time Rifts.
- City features: arena, casino (roulette, slots, blackjack), forge, bounty hall, surf trial, Crucible, pearl exchange, stylist.

## Layout

- `www/js/world.js` terrain, regions, towns list, sky
- `www/js/towns.js` buildings per culture
- `www/js/models.js` people, creatures, objects
- `www/js/combat.js` ring combat
- `www/js/data.js` items, skills, enemies, shops
- `www/js/story.js` quests, NPCs, dialogue, endings
- `www/js/main.js` game loop, streaming, saving
- `www/js/ui.js` HUD, menus, editor, casino
- `www/js/audio.js` synthesised sound

No build step and no downloaded assets: models, terrain and sound are generated in code.
