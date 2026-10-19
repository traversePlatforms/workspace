-- The station's looks (2026-10-18, Matthew: "it didn't look like much in a sense of the walls and the overall station"):
-- a hangar shell with windows and a roof frame, a glass dome over the launch pad, deck plating, proper hangar bases,
-- props (rocket, fuel tanks, crates, satellite dish), a hologram planet, and asteroids outside.
-- Anything with a "SpinSpeed" attribute is turned by the player's own screen (Spin.client.lua), so it costs the server nothing.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Lighting = game:GetService("Lighting")
local Config = require(ReplicatedStorage.Shared.Config)

local C = Config.Colors
local METAL = Color3.fromRGB(140, 148, 170) -- a little lighter (2026-10-18, Matthew: "a little brighter")
local METAL_DARK = Color3.fromRGB(84, 92, 116)
local HAZARD = Color3.fromRGB(255, 196, 60)

local Decor = {}

local function part(parent, props)
	local p = Instance.new(props.ClassName or "Part")
	p.Anchored = true
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.Material = Enum.Material.Metal
	p.CastShadow = true
	for k, v in pairs(props) do
		if k ~= "ClassName" then
			p[k] = v
		end
	end
	p.Parent = parent
	return p
end

local function glow(p, color, range, brightness)
	local l = Instance.new("PointLight")
	l.Color = color
	l.Range = range or 16
	l.Brightness = brightness or 1.5
	l.Parent = p
	return l
end

-- ---------- the hangar shell: walls with windows, pillars, roof beams ----------
local W, D, H = 460, 300, 34 -- deck size and wall height (bigger 2026-10-18: 8 bases)

local function wallRun(folder, from, to, inward)
	local len = (to - from).Magnitude
	local dir = (to - from).Unit
	local bays = math.floor(len / 24)
	local bay = len / bays
	for i = 0, bays do
		local at = from + dir * (i * bay)
		local pillar = part(folder, { Name = "Pillar", Size = Vector3.new(4, H, 4), Color = METAL_DARK, CFrame = CFrame.new(at + Vector3.new(0, H / 2, 0)) })
		part(folder, { Name = "PillarLight", Size = Vector3.new(4.4, 1, 4.4), Color = (i % 2 == 0) and C.Orange or C.Blue, Material = Enum.Material.Neon, CFrame = pillar.CFrame * CFrame.new(0, H / 2 - 2, 0) })
		part(folder, { Name = "PillarFoot", Size = Vector3.new(5.5, 1.2, 5.5), Color = METAL, CFrame = CFrame.new(at + Vector3.new(0, 0.6, 0)) })
		if i < bays then
			local mid = at + dir * (bay / 2)
			local face = CFrame.lookAt(mid, mid + inward)
			-- lower wall, big window, top band
			part(folder, { Name = "WallLow", Size = Vector3.new(bay - 4, 7, 2), Color = METAL, Material = Enum.Material.DiamondPlate, CFrame = face * CFrame.new(0, 3.5, 0) })
			part(folder, { Name = "WallStripe", Size = Vector3.new(bay - 4, 0.6, 2.2), Color = C.Orange, Material = Enum.Material.Neon, CFrame = face * CFrame.new(0, 6.8, 0) })
			part(folder, { Name = "Window", Size = Vector3.new(bay - 4, H - 14, 0.6), Color = C.Blue, Material = Enum.Material.Glass, Transparency = 0.82, CastShadow = false, CFrame = face * CFrame.new(0, 7 + (H - 14) / 2, 0) })
			part(folder, { Name = "WindowBar", Size = Vector3.new(0.8, H - 14, 1), Color = METAL_DARK, CFrame = face * CFrame.new(0, 7 + (H - 14) / 2, 0) })
			part(folder, { Name = "WallTop", Size = Vector3.new(bay - 4, 7, 2), Color = METAL_DARK, CFrame = face * CFrame.new(0, H - 3.5, 0) })
		end
	end
end

local function shell(folder)
	local hx, hz = W / 2, D / 2
	wallRun(folder, Vector3.new(-hx, 0, hz), Vector3.new(hx, 0, hz), Vector3.new(0, 0, -1))
	wallRun(folder, Vector3.new(-hx, 0, -hz), Vector3.new(hx, 0, -hz), Vector3.new(0, 0, 1))
	wallRun(folder, Vector3.new(hx, 0, -hz), Vector3.new(hx, 0, hz), Vector3.new(-1, 0, 0))
	wallRun(folder, Vector3.new(-hx, 0, -hz), Vector3.new(-hx, 0, hz), Vector3.new(1, 0, 0))
	-- the roof frame: beams across, with light strips underneath; open between them so the stars show
	for x = -hx, hx, 38 do
		part(folder, { Name = "RoofBeam", Size = Vector3.new(3, 3, D), Color = METAL_DARK, CFrame = CFrame.new(x, H + 1.5, 0) })
		part(folder, { Name = "RoofLight", Size = Vector3.new(1, 0.4, D - 10), Color = C.Blue, Material = Enum.Material.Neon, CFrame = CFrame.new(x, H - 0.2, 0) })
	end
	for _, z in ipairs({ -hz, -hz / 2, 0, hz / 2, hz }) do
		-- the middle beam runs right over both rockets: leave a gap above each so they can launch (2026-10-18)
		local runs = z == 0 and { { -hx, -176 }, { -144, 189 }, { 211, hx } } or { { -hx, hx } }
		for _, r in ipairs(runs) do
			part(folder, { Name = "RoofCross", Size = Vector3.new(r[2] - r[1], 2, 2), Color = METAL, CFrame = CFrame.new((r[1] + r[2]) / 2, H + 3.5, z) })
		end
	end
	-- hanging lamps over the bases so the deck is lit
	for _, x in ipairs({ -171, -57, 57, 171 }) do
		for _, z in ipairs({ -95, 95, -45, 45 }) do
			local lamp = part(folder, { Name = "Lamp", Size = Vector3.new(6, 1, 6), Color = C.Trim, Material = Enum.Material.Neon, CFrame = CFrame.new(x, H - 1, z) })
			local sl = Instance.new("SpotLight")
			sl.Face = Enum.NormalId.Bottom
			sl.Range = 45
			sl.Angle = 80
			sl.Brightness = 2.4
			sl.Color = Color3.fromRGB(255, 240, 220)
			sl.Parent = lamp
		end
	end
end

-- ---------- the deck: real floor tiles and walkways (2026-10-18, Matthew: "flooring needs to actually be floor") ----------
local TILE_A, TILE_B = Color3.fromRGB(150, 158, 182), Color3.fromRGB(136, 144, 168) -- lighter deck (2026-10-18)
local WALK = Color3.fromRGB(196, 204, 222)

local function plating(folder)
	local tiles = Instance.new("Folder")
	tiles.Name = "FloorTiles"
	tiles.Parent = folder
	local n = 0
	for x = -W / 2 + 10, W / 2 - 10, 20 do
		for z = -D / 2 + 10, D / 2 - 10, 20 do
			n += 1
			local tile = part(tiles, { Name = "Tile", Size = Vector3.new(19.6, 0.2, 19.6), Color = (n % 2 == 0) and TILE_A or TILE_B, Material = Enum.Material.Metal, CastShadow = false, CFrame = CFrame.new(x, 0.1, z) })
			if (math.floor(x / 20) + math.floor(z / 20)) % 3 == 0 then -- a few tiles carry a grille panel
				part(tiles, { Name = "Grille", Size = Vector3.new(6, 0.05, 6), Color = METAL_DARK, Material = Enum.Material.DiamondPlate, CanCollide = false, CastShadow = false, CFrame = tile.CFrame * CFrame.new(0, 0.12, 0) })
			end
		end
	end
	-- walkways: spawn to the tunnel, along both sides of it, and out to every base
	local function walk(a, b, width)
		local mid, len = (a + b) / 2, (b - a).Magnitude
		local cf = CFrame.lookAt(mid, b)
		part(folder, { Name = "Walkway", Size = Vector3.new(width, 0.15, len), Color = WALK, Material = Enum.Material.SmoothPlastic, CastShadow = false, CFrame = cf * CFrame.new(0, 0.28, 0) })
		for _, side in ipairs({ -1, 1 }) do
			part(folder, { Name = "WalkEdge", Size = Vector3.new(0.5, 0.17, len), Color = C.Orange, Material = Enum.Material.Neon, CastShadow = false, CFrame = cf * CFrame.new(side * (width / 2 - 0.25), 0.3, 0) })
		end
	end
	walk(Vector3.new(-145, 0, 0), Vector3.new(-80, 0, 0), 12) -- from the rocket pad past the spawn to the tunnel mouth
	walk(Vector3.new(80, 0, 0), Vector3.new(110, 0, 0), 12)
	for _, z in ipairs({ -22, 22 }) do
		walk(Vector3.new(-205, 0, z), Vector3.new(205, 0, z), 8)
	end
	for _, x in ipairs({ -171, -57, 57, 171 }) do
		walk(Vector3.new(x, 0, 26), Vector3.new(x, 0, 71), 10)
		walk(Vector3.new(x, 0, -26), Vector3.new(x, 0, -71), 10)
	end
end

-- ---------- the launch tunnel (2026-10-18, Matthew: "tunnel needs to be developed more") ----------
-- a glass tube on metal ribs over a moving belt, a glowing portal the critters come out of, and a chute they drop into
local TUNNEL_R = 13

local function rib(folder, x, color)
	local segs = 9
	for i = 0, segs - 1 do -- a half-circle of short beams from one side of the belt, over the top, to the other
		local a0, a1 = math.pi * i / segs, math.pi * (i + 1) / segs
		local p0 = Vector3.new(x, math.sin(a0) * TUNNEL_R, math.cos(a0) * TUNNEL_R)
		local p1 = Vector3.new(x, math.sin(a1) * TUNNEL_R, math.cos(a1) * TUNNEL_R)
		part(folder, { Name = "Rib", Size = Vector3.new(1.4, 1.4, (p1 - p0).Magnitude + 0.5), Color = METAL_DARK, CanCollide = false, CFrame = CFrame.lookAt((p0 + p1) / 2, p1) })
		part(folder, { Name = "RibLight", Size = Vector3.new(0.4, 0.4, (p1 - p0).Magnitude * 0.7), Color = color, Material = Enum.Material.Neon, CanCollide = false, CastShadow = false,
			CFrame = CFrame.lookAt((p0 + p1) / 2, p1) * CFrame.new(0, -0.8, 0) })
	end
	for _, side in ipairs({ -1, 1 }) do -- feet where the rib meets the deck
		part(folder, { Name = "RibFoot", Size = Vector3.new(2.4, 1.6, 2.4), Color = METAL, CFrame = CFrame.new(x, 0.8, side * TUNNEL_R) })
	end
end

local function launchPad(folder)
	local tunnel = Instance.new("Folder")
	tunnel.Name = "Tunnel"
	tunnel.Parent = folder
	-- hazard edging either side of the belt
	for x = -66, 66, 4 do
		local color = ((x / 4) % 2 == 0) and HAZARD or C.Dark
		for _, z in ipairs({ -7.6, 7.6 }) do
			part(tunnel, { Name = "Hazard", Size = Vector3.new(4, 0.2, 1.6), Color = color, Material = Enum.Material.SmoothPlastic, CanCollide = false, CFrame = CFrame.new(x, 0.3, z) })
		end
	end
	-- the belt: rollers along each side and stripes that travel with the critters (Spin.client.lua moves them)
	for x = -64, 64, 2.5 do
		for _, z in ipairs({ -5.9, 5.9 }) do
			part(tunnel, { Name = "Roller", Shape = Enum.PartType.Cylinder, Size = Vector3.new(0.6, 1, 1), Color = METAL, CanCollide = false, CastShadow = false, CFrame = CFrame.new(x, 1.2, z) * CFrame.Angles(0, math.rad(90), 0) })
		end
	end
	for x = -64, 63, 3 do
		local s = part(tunnel, { Name = "BeltStripe", Size = Vector3.new(0.5, 0.06, 10.6), Color = Color3.fromRGB(60, 66, 86), Material = Enum.Material.SmoothPlastic, CanCollide = false, CastShadow = false, CFrame = CFrame.new(x, 1.04, 0) })
		s:SetAttribute("Belt", true)
	end
	for x = -54, 54, 18 do -- chevrons pointing the way the belt moves
		for _, side in ipairs({ -1, 1 }) do
			part(tunnel, { Name = "Arrow", Size = Vector3.new(0.6, 0.12, 4.2), Color = C.Orange, Material = Enum.Material.Neon, CanCollide = false, CastShadow = false,
				CFrame = CFrame.new(x, 1.08, side * 1.4) * CFrame.Angles(0, side * math.rad(-40), 0) })
		end
	end
	-- the glass tube and its ribs
	part(tunnel, { Name = "TubeGlass", Shape = Enum.PartType.Cylinder, Size = Vector3.new(132, TUNNEL_R * 2, TUNNEL_R * 2), Color = C.Blue, Material = Enum.Material.Glass, Transparency = 0.88,
		CanCollide = false, CanQuery = false, CastShadow = false, CFrame = CFrame.new(0, 0, 0) })
	local n = 0
	for x = -64, 64, 8 do
		n += 1
		rib(tunnel, x, (n % 2 == 0) and C.Orange or C.Blue)
	end
	for _, z in ipairs({ -4, 4 }) do -- light strips along the top
		part(tunnel, { Name = "TopLight", Size = Vector3.new(128, 0.4, 0.6), Color = C.Trim, Material = Enum.Material.Neon, CanCollide = false, CastShadow = false, CFrame = CFrame.new(0, TUNNEL_R - 0.9, z) })
	end
	-- the portal the critters come out of
	local portalAt = CFrame.new(-69, 0, 0)
	part(tunnel, { Name = "PortalFrame", Shape = Enum.PartType.Cylinder, Size = Vector3.new(3, TUNNEL_R * 2 + 6, TUNNEL_R * 2 + 6), Color = METAL_DARK, CFrame = portalAt })
	part(tunnel, { Name = "PortalRing", Shape = Enum.PartType.Cylinder, Size = Vector3.new(3.2, TUNNEL_R * 2 + 1, TUNNEL_R * 2 + 1), Color = C.Orange, Material = Enum.Material.Neon, CFrame = portalAt })
	local swirl = part(tunnel, { Name = "PortalSwirl", Shape = Enum.PartType.Cylinder, Size = Vector3.new(3.4, TUNNEL_R * 2 - 2, TUNNEL_R * 2 - 2), Color = C.Blue, Material = Enum.Material.ForceField, CFrame = portalAt })
	swirl:SetAttribute("SpinSpeed", 0) -- ForceField material shimmers by itself
	glow(swirl, C.Blue, 30, 3)
	local spark = Instance.new("ParticleEmitter")
	spark.Texture = "rbxasset://textures/particles/sparkles_main.dds"
	spark.Color = ColorSequence.new(C.Blue, C.Orange)
	spark.LightEmission = 1
	spark.Rate = 25
	spark.Speed = NumberRange.new(3, 8)
	spark.Lifetime = NumberRange.new(0.6, 1.2)
	spark.EmissionDirection = Enum.NormalId.Top
	spark.Size = NumberSequence.new(0.5, 0)
	spark.Parent = swirl
	-- the chute at the far end
	local chuteAt = CFrame.new(69, 0, 0)
	part(tunnel, { Name = "ChuteFrame", Shape = Enum.PartType.Cylinder, Size = Vector3.new(3, TUNNEL_R * 2 + 6, TUNNEL_R * 2 + 6), Color = METAL_DARK, CFrame = chuteAt })
	part(tunnel, { Name = "ChuteRing", Shape = Enum.PartType.Cylinder, Size = Vector3.new(3.2, TUNNEL_R * 2 + 1, TUNNEL_R * 2 + 1), Color = C.Blue, Material = Enum.Material.Neon, CFrame = chuteAt })
	part(tunnel, { Name = "ChuteHole", Shape = Enum.PartType.Cylinder, Size = Vector3.new(3.4, TUNNEL_R * 2 - 2, TUNNEL_R * 2 - 2), Color = C.Dark, Material = Enum.Material.SmoothPlastic, CFrame = chuteAt })
	-- the hologram planet, projected from the top of the tunnel
	local holo = part(folder, { Name = "HoloPlanet", Shape = Enum.PartType.Ball, Size = Vector3.new(9, 9, 9), Color = C.Blue, Material = Enum.Material.ForceField, CanCollide = false, CastShadow = false, CFrame = CFrame.new(0, TUNNEL_R + 9, 0) })
	holo:SetAttribute("SpinSpeed", 25)
	glow(holo, C.Blue, 24, 2)
	local ring = part(folder, { Name = "HoloRing", Shape = Enum.PartType.Cylinder, Size = Vector3.new(0.3, 16, 16), Color = C.Orange, Material = Enum.Material.Neon, Transparency = 0.3, CanCollide = false, CastShadow = false, CFrame = CFrame.new(0, TUNNEL_R + 9, 0) * CFrame.Angles(0, 0, math.rad(80)) })
	ring:SetAttribute("SpinSpeed", -40)
	part(folder, { Name = "HoloBase", Shape = Enum.PartType.Cylinder, Size = Vector3.new(1.2, 7, 7), Color = METAL, CanCollide = false, CFrame = CFrame.new(0, TUNNEL_R + 0.4, 0) * CFrame.Angles(0, 0, math.rad(90)) })
	part(folder, { Name = "HoloBeam", Shape = Enum.PartType.Cylinder, Size = Vector3.new(5, 3, 3), Color = C.Blue, Material = Enum.Material.Neon, Transparency = 0.6, CanCollide = false, CastShadow = false, CFrame = CFrame.new(0, TUNNEL_R + 3.5, 0) * CFrame.Angles(0, 0, math.rad(90)) })
end

-- ---------- bases: pillars, a roof with light trim, an entrance arch, wall lights ----------
local function hangar(folder, base)
	local cf, hw, hd = base.cf, base.halfW, base.halfD
	for _, sx in ipairs({ -1, 1 }) do
		for _, sz in ipairs({ -1, 1 }) do
			part(folder, { Name = "BasePillar", Size = Vector3.new(2.6, 16, 2.6), Color = METAL_DARK, CFrame = cf * CFrame.new(sx * (hw + 0.6), 8, sz * (hd + 0.6)) })
		end
	end
	-- a glass roof on a metal frame over the whole base, so you can still see in from above
	local RY = 16.2
	part(folder, { Name = "BaseRoofGlass", Size = Vector3.new(hw * 2 + 2, 0.4, hd * 2 + 2), Color = C.Blue, Material = Enum.Material.Glass, Transparency = 0.7, CastShadow = false, CFrame = cf * CFrame.new(0, RY, 0) })
	for _, sz in ipairs({ -1, 0, 1 }) do
		part(folder, { Name = "BaseRoofBeam", Size = Vector3.new(hw * 2 + 3, 1.2, 1.4), Color = METAL_DARK, CFrame = cf * CFrame.new(0, RY + 0.4, sz * hd) })
	end
	for _, sx in ipairs({ -1, -0.33, 0.33, 1 }) do
		part(folder, { Name = "BaseRoofBeam", Size = Vector3.new(1.4, 1.2, hd * 2 + 3), Color = METAL_DARK, CFrame = cf * CFrame.new(sx * hw, RY + 0.4, 0) })
	end
	part(folder, { Name = "BaseRoofEdge", Size = Vector3.new(hw * 2 + 3.4, 0.6, 0.8), Color = C.Orange, Material = Enum.Material.Neon, CFrame = cf * CFrame.new(0, RY - 0.2, -hd - 1) })
	for i = -2, 2 do -- strip lights under the roof
		local strip = part(folder, { Name = "BaseRoofLight", Size = Vector3.new(0.6, 0.3, hd * 2 - 4), Color = C.Blue, Material = Enum.Material.Neon, CastShadow = false, CFrame = cf * CFrame.new(i * 10, RY - 0.5, 0) })
		if i == 0 then
			glow(strip, C.Blue, 34, 1.3)
		end
	end
	-- the entrance arch
	for _, side in ipairs({ -1, 1 }) do
		part(folder, { Name = "ArchPost", Size = Vector3.new(2, 12, 2), Color = METAL_DARK, CFrame = cf * CFrame.new(side * 9.5, 6, -hd) })
		part(folder, { Name = "ArchLight", Size = Vector3.new(0.6, 10, 0.6), Color = C.Blue, Material = Enum.Material.Neon, CFrame = cf * CFrame.new(side * 9.5, 6, -hd - 1.1) })
	end
	part(folder, { Name = "ArchTop", Size = Vector3.new(21, 2.2, 2.4), Color = METAL_DARK, CFrame = cf * CFrame.new(0, 12.6, -hd) })
	local num = part(folder, { Name = "ArchSign", Size = Vector3.new(8, 1.8, 0.3), Color = C.Dark, CFrame = cf * CFrame.new(0, 12.6, -hd - 1.3) })
	local g = Instance.new("SurfaceGui")
	g.Face = Enum.NormalId.Front
	g.LightInfluence = 0
	g.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
	g.PixelsPerStud = 40
	g.Parent = num
	local l = Instance.new("TextLabel")
	l.Size = UDim2.fromScale(1, 1)
	l.BackgroundTransparency = 1
	l.Font = Enum.Font.FredokaOne
	l.TextScaled = true
	l.TextColor3 = C.Orange
	l.Text = "BAY " .. base.index
	l.Parent = g
end

-- ---------- props ----------
-- a proper rocket (2026-10-18, Matthew: "the rockets there need to look more like rockets"): a tall white body with
-- black roll stripes, a pointed orange nose cone, swept fins, a flared engine bell, side boosters and a launch tower.
-- Everything stays under the hangar roof (34 studs). s scales the whole thing; full = boosters and tower too.
local function cylY(parent, name, at, y, h, r, color, props)
	local p = { Name = name, Shape = Enum.PartType.Cylinder, Size = Vector3.new(h, r * 2, r * 2), Color = color, Material = Enum.Material.SmoothPlastic,
		CFrame = at * CFrame.new(0, y, 0) * CFrame.Angles(0, 0, math.rad(90)) }
	for k, v in pairs(props or {}) do
		p[k] = v
	end
	return part(parent, p)
end

-- a pointed cone from stacked slices: base radius r at y0, rising h studs to a point
local function cone(parent, at, y0, h, r, color, slices)
	slices = slices or 10
	local sh = h / slices
	for i = 0, slices - 1 do
		local t = i / slices
		cylY(parent, "Cone", at, y0 + sh * (i + 0.5), sh + 0.02, math.max(0.15, r * (1 - t) ^ 0.75), color)
	end
end

local function flame(parent, scale)
	local f = Instance.new("ParticleEmitter")
	f.Color = ColorSequence.new(Color3.fromRGB(255, 230, 150), Color3.fromRGB(255, 110, 50))
	f.Texture = "rbxasset://textures/particles/fire_main.dds"
	f.LightEmission = 1
	f.Size = NumberSequence.new({ NumberSequenceKeypoint.new(0, 1.6 * scale), NumberSequenceKeypoint.new(1, 0) })
	f.Lifetime = NumberRange.new(0.3, 0.6)
	f.Rate = 40
	f.Speed = NumberRange.new(5, 9)
	f.EmissionDirection = Enum.NormalId.Left -- a quarter-turned cylinder's -X points down
	f.Parent = parent
	return f
end

local function booster(m, at, s)
	local R = 1.6 * s
	cylY(m, "BoosterBody", at, 9 * s, 14 * s, R, C.Trim)
	cylY(m, "BoosterBand", at, 14 * s, 0.8 * s, R + 0.1, C.Orange)
	cone(m, at, 16 * s, 3.5 * s, R, C.Trim, 6)
	cylY(m, "BoosterNozzle", at, 1.4 * s, 1.2 * s, R * 0.75, METAL_DARK, { Material = Enum.Material.Metal })
	local n = cylY(m, "BoosterBell", at, 0.7 * s, 0.6 * s, R * 0.95, METAL_DARK, { Material = Enum.Material.Metal })
	flame(n, s * 0.7)
end

local function tower(m, at, s, rocketR)
	-- beside the rocket on its right, facing it (its -Z points at the rocket), so the name and windows on the front stay in view
	local towerPos = (at * CFrame.new(rocketR + 7 * s, 0, 0)).Position
	local base = CFrame.lookAt(towerPos, Vector3.new(at.Position.X, towerPos.Y, at.Position.Z))
	local h = 31 * s
	for _, x in ipairs({ -2.2, 2.2 }) do
		for _, z in ipairs({ -2.2, 2.2 }) do
			part(m, { Name = "TowerPost", Size = Vector3.new(0.7, h, 0.7), Color = Color3.fromRGB(230, 80, 60), CFrame = base * CFrame.new(x * s, h / 2, z * s) })
		end
	end
	for y = 3, h - 1, 4 * s do -- criss-cross bracing on every face
		for _, face in ipairs({ 0, 90, 180, 270 }) do
			local f = base * CFrame.Angles(0, math.rad(face), 0) * CFrame.new(0, y, -2.2 * s)
			part(m, { Name = "Brace", Size = Vector3.new(6.2 * s, 0.35, 0.35), Color = Color3.fromRGB(200, 70, 55), CFrame = f * CFrame.Angles(0, 0, math.rad(40)) })
			part(m, { Name = "Brace", Size = Vector3.new(4.4 * s, 0.4, 0.4), Color = METAL, CFrame = f * CFrame.new(0, 2 * s, 0) })
		end
	end
	-- the access arm to the crew cabin, and a blinking beacon on top
	local armY = 23 * s
	part(m, { Name = "AccessArm", Size = Vector3.new(2.2 * s, 1.6 * s, 7 * s), Color = METAL, CFrame = base * CFrame.new(0, armY, -(3.5 * s + 1)) })
	part(m, { Name = "ArmRail", Size = Vector3.new(0.2, 0.2, 7 * s), Color = HAZARD, Material = Enum.Material.Neon, CFrame = base * CFrame.new(1.1 * s, armY + 0.9 * s, -(3.5 * s + 1)) })
	local beacon = part(m, { Name = "Beacon", Shape = Enum.PartType.Ball, Size = Vector3.new(1.2, 1.2, 1.2), Color = Color3.fromRGB(255, 60, 60), Material = Enum.Material.Neon,
		CFrame = base * CFrame.new(0, h + 0.6, 0) })
	beacon:SetAttribute("Blink", true)
	glow(beacon, Color3.fromRGB(255, 60, 60), 18, 2)
end

local function rocket(folder, at, s, full)
	s = s or 1
	local m = Instance.new("Model")
	m.Name = "Rocket"
	m.Parent = folder
	local R = 3.6 * s
	-- launch pad: a round platform, hazard ring and clamps
	cylY(m, "LaunchPadBase", at, 0.6, 1.2, 12 * s, METAL_DARK, { Material = Enum.Material.DiamondPlate })
	cylY(m, "PadRing", at, 1.25, 0.12, 11.2 * s, HAZARD, { Material = Enum.Material.Neon })
	cylY(m, "PadInner", at, 1.3, 0.12, 10.6 * s, METAL_DARK, { Material = Enum.Material.DiamondPlate })
	for i = 0, 3 do
		part(m, { Name = "Clamp", Size = Vector3.new(1.2 * s, 2.4 * s, 2.4 * s), Color = METAL,
			CFrame = at * CFrame.Angles(0, math.rad(i * 90), 0) * CFrame.new(0, 1.2 + 1.2 * s, -(R + 1.6 * s)) })
	end
	-- engine: a bell that flares out toward the bottom
	for i, r in ipairs({ 1.4, 1.9, 2.4, 2.8 }) do
		local bell = cylY(m, "EngineBell", at, 1.3 + (4.6 - i) * 0.75 * s, 0.78 * s, r * s, METAL_DARK, { Material = Enum.Material.Metal })
		if i == 4 then
			flame(bell, s)
			glow(bell, C.Orange, 20, 2.5)
		end
	end
	-- body, roll stripes, bands, name
	local y0 = 1.3 + 3.1 * s
	local bodyH = 17 * s
	cylY(m, "Body", at, y0 + bodyH / 2, bodyH, R, Color3.fromRGB(246, 247, 252))
	for _, a in ipairs({ 0, 180 }) do
		part(m, { Name = "RollStripe", Size = Vector3.new(2.6 * s, bodyH - 2 * s, 0.3), Color = C.Dark,
			CFrame = at * CFrame.Angles(0, math.rad(a + 90), 0) * CFrame.new(0, y0 + bodyH / 2, -R + 0.1) })
	end
	for _, y in ipairs({ y0 + 1.2 * s, y0 + bodyH - 1.2 * s }) do
		cylY(m, "Band", at, y, 1 * s, R + 0.08, C.Orange)
	end
	local plate = part(m, { Name = "NamePlate", Size = Vector3.new(bodyH - 5 * s, 2.2 * s, 0.1), Color = Color3.fromRGB(246, 247, 252), Transparency = 1, CanCollide = false,
		CFrame = at * CFrame.new(0, y0 + bodyH / 2, -R - 0.06) * CFrame.Angles(0, 0, math.rad(90)) })
	local g = Instance.new("SurfaceGui")
	g.Face = Enum.NormalId.Front
	g.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
	g.PixelsPerStud = 30
	g.Parent = plate
	local l = Instance.new("TextLabel")
	l.Size = UDim2.fromScale(1, 1)
	l.BackgroundTransparency = 1
	l.Font = Enum.Font.FredokaOne
	l.TextScaled = true
	l.TextColor3 = Color3.fromRGB(40, 70, 140)
	l.Text = "STAR STATION"
	l.Parent = g
	-- crew cabin with portholes, then the nose cone and a beacon on the tip
	local cy = y0 + bodyH
	cylY(m, "Cabin", at, cy + 2 * s, 4 * s, R * 0.94, Color3.fromRGB(225, 230, 240))
	for i = -1, 1 do
		part(m, { Name = "Porthole", Shape = Enum.PartType.Ball, Size = Vector3.new(1.3, 1.3, 1.3) * s, Color = C.Blue, Material = Enum.Material.Neon,
			CFrame = at * CFrame.Angles(0, math.rad(i * 35), 0) * CFrame.new(0, cy + 2 * s, -R * 0.94 + 0.25) })
	end
	cone(m, at, cy + 4 * s, 7 * s, R * 0.94, C.Orange, full and 20 or 12)
	local tip = part(m, { Name = "NoseTip", Shape = Enum.PartType.Ball, Size = Vector3.new(0.6, 0.6, 0.6) * s, Color = Color3.fromRGB(255, 70, 70), Material = Enum.Material.Neon,
		CFrame = at * CFrame.new(0, cy + 11 * s, 0) })
	tip:SetAttribute("Blink", true)
	-- swept fins between the boosters
	for _, a in ipairs({ 45, 135, 225, 315 }) do
		part(m, { ClassName = "WedgePart", Name = "Fin", Size = Vector3.new(0.6 * s, 7 * s, 3.6 * s), Color = C.Blue,
			CFrame = at * CFrame.Angles(0, math.rad(a), 0) * CFrame.new(0, 1.4 + 3.5 * s, -(R + 1.8 * s) + 0.1) })
		part(m, { Name = "FinEdge", Size = Vector3.new(0.7 * s, 0.3 * s, 3.6 * s), Color = C.Orange, Material = Enum.Material.Neon,
			CFrame = at * CFrame.Angles(0, math.rad(a), 0) * CFrame.new(0, 1.55, -(R + 1.8 * s) + 0.1) })
	end
	if full then
		for _, side in ipairs({ -1, 1 }) do
			booster(m, at * CFrame.new(side * (R + 1.9 * s), 1.2, 0), s)
		end
		tower(m, at, s, R)
		for _, side in ipairs({ -1, 1 }) do -- floodlights at the pad edge shining up the rocket
			local lamp = part(m, { Name = "Floodlight", Size = Vector3.new(1.6, 1, 1.6), Color = C.Trim, Material = Enum.Material.Neon,
				CFrame = at * CFrame.new(side * 9 * s, 1.7, -9 * s) })
			local sl = Instance.new("SpotLight")
			sl.Face = Enum.NormalId.Top
			sl.Angle = 50
			sl.Range = 40
			sl.Brightness = 3
			sl.Parent = lamp
		end
	end
	-- the LAUNCH console beside the pad (2026-10-18, Matthew: "can the rockets launch into the sky?")
	local console = part(m, { Name = "LaunchConsole", Size = Vector3.new(2.4, 3.4, 1.8), Color = METAL_DARK, CFrame = at * CFrame.new(7 * s + 2, 1.7, -(12 * s + 2)) })
	local button = part(m, { Name = "LaunchButton", Shape = Enum.PartType.Cylinder, Size = Vector3.new(0.5, 1.4, 1.4), Color = Color3.fromRGB(255, 60, 60), Material = Enum.Material.Neon,
		CFrame = console.CFrame * CFrame.new(0, 1.9, 0) * CFrame.Angles(0, 0, math.rad(90)) })
	glow(button, Color3.fromRGB(255, 60, 60), 8, 1.5)
	local sign = part(m, { Name = "LaunchSign", Size = Vector3.new(2.3, 0.8, 0.1), Color = C.Dark, CFrame = console.CFrame * CFrame.new(0, 0.9, -0.95) })
	local sg = Instance.new("SurfaceGui")
	sg.Face = Enum.NormalId.Front
	sg.LightInfluence = 0
	sg.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
	sg.PixelsPerStud = 50
	sg.Parent = sign
	local sl2 = Instance.new("TextLabel")
	sl2.Size = UDim2.fromScale(1, 1)
	sl2.BackgroundTransparency = 1
	sl2.Font = Enum.Font.FredokaOne
	sl2.TextScaled = true
	sl2.TextColor3 = Color3.fromRGB(255, 90, 90)
	sl2.Text = "LAUNCH"
	sl2.Parent = sg
	-- what stays behind when it launches: the pad, the tower, the lights and this console; everything else flies
	local STAY = { LaunchPadBase = true, PadRing = true, PadInner = true, Clamp = true, TowerPost = true, Brace = true, AccessArm = true,
		ArmRail = true, Beacon = true, Floodlight = true, LaunchConsole = true, LaunchButton = true, LaunchSign = true }
	for _, p in ipairs(m:GetDescendants()) do
		if p:IsA("BasePart") and STAY[p.Name] then
			p:SetAttribute("Stays", true)
		end
	end
	m:SetAttribute("Launchable", true)
	return m
end

-- ---------- the Gear Bay (2026-10-18, Matthew: "to the left of the tunnel there should be some equipment and weapons") ----------
-- an open-fronted armoury facing the tunnel: three display stands (Boing Glove, Star Blaster, Jet Boots), space suits,
-- helmets on a shelf, oxygen tanks and a tool chest. Returns each stand so Main.server.lua can put the Buy prompts on them.
local function spaceSuit(parent, at)
	local suit = C.Trim
	for _, side in ipairs({ -1, 1 }) do
		part(parent, { Name = "SuitLeg", Size = Vector3.new(1.3, 3.6, 1.4), Color = suit, Material = Enum.Material.Fabric, CFrame = at * CFrame.new(side * 0.75, 2.6, 0) })
		part(parent, { Name = "SuitBoot", Size = Vector3.new(1.5, 0.9, 1.9), Color = C.Orange, CFrame = at * CFrame.new(side * 0.75, 0.95, -0.2) })
		part(parent, { Name = "SuitArm", Size = Vector3.new(1.1, 3.4, 1.2), Color = suit, Material = Enum.Material.Fabric, CFrame = at * CFrame.new(side * 2.15, 6.1, 0) * CFrame.Angles(0, 0, side * 0.15) })
		part(parent, { Name = "SuitGlove", Shape = Enum.PartType.Ball, Size = Vector3.new(1.1, 1.1, 1.1), Color = C.Orange, CFrame = at * CFrame.new(side * 2.45, 4.3, 0) })
	end
	part(parent, { Name = "SuitBody", Size = Vector3.new(3.2, 3.8, 1.9), Color = suit, Material = Enum.Material.Fabric, CFrame = at * CFrame.new(0, 6.2, 0) })
	part(parent, { Name = "SuitPanel", Size = Vector3.new(1.6, 1, 0.2), Color = C.Blue, Material = Enum.Material.Neon, CFrame = at * CFrame.new(0, 6.6, -1) })
	part(parent, { Name = "SuitPack", Size = Vector3.new(2.6, 3.2, 1.2), Color = METAL, CFrame = at * CFrame.new(0, 6.4, 1.5) })
	part(parent, { Name = "SuitHelmet", Shape = Enum.PartType.Ball, Size = Vector3.new(2.8, 2.8, 2.8), Color = suit, CFrame = at * CFrame.new(0, 9.4, 0) })
	part(parent, { Name = "SuitVisor", Size = Vector3.new(2.0, 1.3, 0.5), Color = C.Orange, Material = Enum.Material.Glass, Transparency = 0.15, CFrame = at * CFrame.new(0, 9.5, -1.2) })
end

local function gearBay(folder, at)
	local GearTools = require(script.Parent.GearTools)
	local m = Instance.new("Model")
	m.Name = "GearBay"
	m.Parent = folder
	local LIGHT_METAL = Color3.fromRGB(176, 184, 204)
	part(m, { Name = "BayFloor", Size = Vector3.new(46, 0.5, 22), Color = LIGHT_METAL, Material = Enum.Material.DiamondPlate, CFrame = at * CFrame.new(0, 0.45, 0) })
	part(m, { Name = "BayEdge", Size = Vector3.new(46, 0.2, 0.6), Color = C.Orange, Material = Enum.Material.Neon, CFrame = at * CFrame.new(0, 0.75, -10.8) })
	part(m, { Name = "BayBackWall", Size = Vector3.new(46, 16, 1.5), Color = METAL, Material = Enum.Material.Metal, CFrame = at * CFrame.new(0, 8, 11) })
	part(m, { Name = "BayWallStripe", Size = Vector3.new(46, 0.6, 1.7), Color = C.Blue, Material = Enum.Material.Neon, CFrame = at * CFrame.new(0, 4, 11) })
	for _, side in ipairs({ -1, 1 }) do
		part(m, { Name = "BaySideWall", Size = Vector3.new(1.5, 16, 12), Color = METAL, CFrame = at * CFrame.new(side * 23, 8, 5.6) })
		part(m, { Name = "BayPost", Size = Vector3.new(2, 17, 2), Color = METAL_DARK, CFrame = at * CFrame.new(side * 23, 8.5, -0.6) })
		part(m, { Name = "BayPostLight", Size = Vector3.new(0.5, 14, 0.5), Color = C.Orange, Material = Enum.Material.Neon, CFrame = at * CFrame.new(side * 23, 8, -1.7) })
	end
	local roof = part(m, { Name = "BayRoof", Size = Vector3.new(48, 0.8, 13), Color = METAL_DARK, CFrame = at * CFrame.new(0, 16.6, 4.6) })
	for _, x in ipairs({ -13, 0, 13 }) do
		local lamp = part(m, { Name = "BayLamp", Size = Vector3.new(5, 0.3, 2), Color = C.Trim, Material = Enum.Material.Neon, CFrame = roof.CFrame * CFrame.new(x, -0.5, -4) })
		local sl = Instance.new("SpotLight")
		sl.Face = Enum.NormalId.Bottom
		sl.Angle = 70
		sl.Range = 24
		sl.Brightness = 2.5
		sl.Parent = lamp
	end
	-- the sign
	local sign = part(m, { Name = "BaySign", Size = Vector3.new(22, 3.6, 0.4), Color = C.Dark, CFrame = at * CFrame.new(0, 13.4, 10.1) })
	local g = Instance.new("SurfaceGui")
	g.Face = Enum.NormalId.Front
	g.LightInfluence = 0
	g.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
	g.PixelsPerStud = 40
	g.Parent = sign
	local l = Instance.new("TextLabel")
	l.Size = UDim2.fromScale(1, 1)
	l.BackgroundTransparency = 1
	l.Font = Enum.Font.FredokaOne
	l.TextScaled = true
	l.TextColor3 = C.Orange
	l.Text = "GEAR BAY"
	l.Parent = g
	-- three display stands
	local stands = {}
	for i, id in ipairs({ "glove", "blaster", "boots" }) do
		local x = (i - 2) * 13
		local def = Config.gearById(id)
		local stand = part(m, { Name = "GearStand", Shape = Enum.PartType.Cylinder, Size = Vector3.new(3.2, 5, 5), Color = METAL_DARK, CFrame = at * CFrame.new(x, 2.3, -1) * CFrame.Angles(0, 0, math.rad(90)) })
		part(m, { Name = "StandRing", Shape = Enum.PartType.Cylinder, Size = Vector3.new(0.3, 5.3, 5.3), Color = def.kind == "weapon" and C.Orange or C.Blue, Material = Enum.Material.Neon,
			CFrame = at * CFrame.new(x, 3.95, -1) * CFrame.Angles(0, 0, math.rad(90)) })
		local beam = part(m, { Name = "HoloBeam", Shape = Enum.PartType.Cylinder, Size = Vector3.new(4, 3.4, 3.4), Color = C.Blue, Material = Enum.Material.Neon, Transparency = 0.75, CanCollide = false, CastShadow = false,
			CFrame = at * CFrame.new(x, 6, -1) * CFrame.Angles(0, 0, math.rad(90)) })
		glow(beam, def.kind == "weapon" and C.Orange or C.Blue, 14, 1.6)
		local show = GearTools.display(id, at * CFrame.new(x, 7.2, -1), m)
		show:SetAttribute("SpinSpeed", 45)
		local tag = part(m, { Name = "StandTag", Size = Vector3.new(6, 1.6, 0.3), Color = C.Dark, CFrame = at * CFrame.new(x, 1.6, -3.7) * CFrame.Angles(math.rad(-20), 0, 0) })
		local tg = Instance.new("SurfaceGui")
		tg.Face = Enum.NormalId.Front
		tg.LightInfluence = 0
		tg.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
		tg.PixelsPerStud = 50
		tg.Parent = tag
		local tl = Instance.new("TextLabel")
		tl.Size = UDim2.fromScale(1, 1)
		tl.BackgroundTransparency = 1
		tl.Font = Enum.Font.FredokaOne
		tl.TextScaled = true
		tl.TextColor3 = C.Trim
		tl.RichText = true
		tl.Text = def.name .. "\n<font color=\"#FFBA7D\">" .. def.price .. " ★</font>"
		tl.Parent = tg
		stands[id] = stand
	end
	-- along the back wall: space suits, a helmet shelf, oxygen tanks, a tool chest
	for _, x in ipairs({ -19, 19 }) do
		spaceSuit(m, at * CFrame.new(x, 0.7, 8.4))
	end
	local shelf = part(m, { Name = "Shelf", Size = Vector3.new(16, 0.5, 2.4), Color = METAL_DARK, CFrame = at * CFrame.new(0, 9.4, 9.4) })
	for i = -2, 2 do
		local helmet = part(m, { Name = "Helmet", Shape = Enum.PartType.Ball, Size = Vector3.new(2.2, 2.2, 2.2), Color = (i % 2 == 0) and C.Trim or C.Orange, CFrame = shelf.CFrame * CFrame.new(i * 3.1, 1.35, 0) })
		part(m, { Name = "HelmetVisor", Size = Vector3.new(1.5, 0.9, 0.3), Color = C.Blue, Material = Enum.Material.Glass, Transparency = 0.1, CFrame = helmet.CFrame * CFrame.new(0, 0.1, -0.95) })
	end
	for i, x in ipairs({ -10, -8.4, 8.4, 10 }) do
		cylY(m, "OxygenTank", at * CFrame.new(x, 0.7, 9.2), 2.6, 5.2, 0.75, (i % 2 == 0) and C.Blue or C.Trim)
		part(m, { Name = "TankValve", Shape = Enum.PartType.Ball, Size = Vector3.new(0.8, 0.8, 0.8), Color = METAL, CFrame = at * CFrame.new(x, 6.1, 9.2) })
	end
	local chest = part(m, { Name = "ToolChest", Size = Vector3.new(5, 3.2, 2.2), Color = Color3.fromRGB(220, 70, 60), CFrame = at * CFrame.new(0, 2.3, 9.2) })
	for i = 0, 2 do
		part(m, { Name = "Drawer", Size = Vector3.new(4.4, 0.12, 0.1), Color = METAL, CFrame = chest.CFrame * CFrame.new(0, -1 + i * 0.9, -1.12) })
	end
	return stands
end

-- ---------- a moon rover parked near the spawn, and a UFO beaming up crates ----------
local function rover(folder, at)
	local m = Instance.new("Model")
	m.Name = "Rover"
	m.Parent = folder
	part(m, { Name = "Chassis", Size = Vector3.new(5, 1.6, 9), Color = C.Trim, CFrame = at * CFrame.new(0, 2.6, 0) })
	part(m, { Name = "ChassisStripe", Size = Vector3.new(5.1, 0.4, 9.1), Color = C.Orange, Material = Enum.Material.Neon, CFrame = at * CFrame.new(0, 2.4, 0) })
	for _, z in ipairs({ -3.4, 0, 3.4 }) do
		for _, side in ipairs({ -1, 1 }) do
			part(m, { Name = "Wheel", Shape = Enum.PartType.Cylinder, Size = Vector3.new(1, 2.6, 2.6), Color = Color3.fromRGB(50, 54, 70), CFrame = at * CFrame.new(side * 2.9, 1.3, z) })
			part(m, { Name = "Hub", Shape = Enum.PartType.Cylinder, Size = Vector3.new(1.1, 1, 1), Color = C.Blue, Material = Enum.Material.Neon, CFrame = at * CFrame.new(side * 2.9, 1.3, z) })
		end
	end
	part(m, { Name = "SolarPanel", Size = Vector3.new(6.5, 0.2, 4.5), Color = Color3.fromRGB(40, 60, 130), Material = Enum.Material.Glass, CFrame = at * CFrame.new(0, 3.6, 1.8) * CFrame.Angles(math.rad(-12), 0, 0) })
	part(m, { Name = "Mast", Size = Vector3.new(0.4, 3.4, 0.4), Color = METAL, CFrame = at * CFrame.new(1.9, 5.1, -3.6) }) -- front corner, out of the driver's way
	local cam = part(m, { Name = "CameraHead", Size = Vector3.new(1.6, 1, 1), Color = C.Trim, CFrame = at * CFrame.new(1.9, 7.1, -3.6) })
	for _, side in ipairs({ -1, 1 }) do
		part(m, { Name = "Lens", Shape = Enum.PartType.Ball, Size = Vector3.new(0.5, 0.5, 0.5), Color = C.Blue, Material = Enum.Material.Neon, CFrame = cam.CFrame * CFrame.new(side * 0.4, 0, -0.5) })
	end
	local dish = part(m, { Name = "RoverDish", Size = Vector3.new(2.4, 0.6, 2.4), Color = C.Trim, CFrame = at * CFrame.new(1.5, 4.8, 3.4) * CFrame.Angles(math.rad(30), 0, 0) })
	local dm = Instance.new("SpecialMesh")
	dm.MeshType = Enum.MeshType.Sphere
	dm.Parent = dish

	-- drivable (2026-10-18, Matthew: "make it so you can drive the rover"): everything welds to one invisible hull that
	-- floats just off the deck. Hover height, heading and speed come from three constraints; while someone drives, their
	-- own screen sets them (Rover.client.lua), otherwise the server holds it still. Its underside is 0.9 up, so it rides
	-- over walkways but bumps off base floors, the launch pad and walls.
	local hull = part(m, { Name = "Hull", Size = Vector3.new(6.2, 2, 9.8), Transparency = 1, CanCollide = true, Material = Enum.Material.SmoothPlastic,
		CustomPhysicalProperties = PhysicalProperties.new(0.7, 0.1, 0.2), CFrame = at * CFrame.new(0, 1.9, 0) })
	local seat = Instance.new("VehicleSeat")
	seat.Name = "DriverSeat"
	seat.Size = Vector3.new(2.2, 0.6, 2.2)
	seat.Color = C.Orange
	seat.Material = Enum.Material.Fabric
	seat.HeadsUpDisplay = false
	seat.TopSurface = Enum.SurfaceType.Smooth
	seat.CFrame = at * CFrame.new(0, 3.7, -1.2)
	seat:SetAttribute("Rover", true)
	seat.Parent = m
	part(m, { Name = "SeatBack", Size = Vector3.new(2.2, 1.8, 0.4), Color = C.Orange, Material = Enum.Material.Fabric, CFrame = at * CFrame.new(0, 4.6, -0.05) })
	for _, p in ipairs(m:GetDescendants()) do
		if p:IsA("BasePart") then
			p.Anchored = false
			if p ~= hull then
				p.CanCollide = false
				p.Massless = true
				local w = Instance.new("WeldConstraint")
				w.Part0 = hull
				w.Part1 = p
				w.Parent = p
			end
		end
	end
	local att = Instance.new("Attachment")
	att.Name = "Drive"
	att.Parent = hull
	local lv = Instance.new("LinearVelocity")
	lv.Attachment0 = att
	lv.RelativeTo = Enum.ActuatorRelativeTo.World
	lv.ForceLimitMode = Enum.ForceLimitMode.PerAxis
	lv.MaxAxesForce = Vector3.new(60000, 0, 60000) -- sideways only: the hover holds the height
	lv.VectorVelocity = Vector3.zero
	lv.Parent = hull
	local hover = Instance.new("AlignPosition")
	hover.Mode = Enum.PositionAlignmentMode.OneAttachment
	hover.Attachment0 = att
	hover.ForceLimitMode = Enum.ForceLimitMode.PerAxis
	hover.MaxAxesForce = Vector3.new(0, 200000, 0)
	hover.Responsiveness = 40
	hover.Position = hull.Position
	hover.Parent = hull
	local turn = Instance.new("AlignOrientation")
	turn.Mode = Enum.OrientationAlignmentMode.OneAttachment
	turn.Attachment0 = att
	turn.MaxTorque = 1e7
	turn.Responsiveness = 25
	turn.CFrame = hull.CFrame - hull.Position
	turn.Parent = hull
	m.PrimaryPart = hull
	return m
end

local function ufo(folder, at, beamTo)
	local m = Instance.new("Model")
	m.Name = "UFO"
	m.Parent = folder
	local disc = part(m, { Name = "Saucer", Size = Vector3.new(16, 2.2, 16), Color = Color3.fromRGB(200, 206, 222), CanCollide = false, CFrame = at })
	local sm = Instance.new("SpecialMesh")
	sm.MeshType = Enum.MeshType.Sphere
	sm.Parent = disc
	part(m, { Name = "Dome", Shape = Enum.PartType.Ball, Size = Vector3.new(6.5, 6.5, 6.5), Color = Color3.fromRGB(140, 255, 190), Material = Enum.Material.Glass, Transparency = 0.35, CanCollide = false, CFrame = at * CFrame.new(0, 1.2, 0) })
	part(m, { Name = "Pilot", Shape = Enum.PartType.Ball, Size = Vector3.new(2.2, 2.2, 2.2), Color = Color3.fromRGB(120, 220, 90), CanCollide = false, CFrame = at * CFrame.new(0, 1.9, 0) })
	for _, side in ipairs({ -1, 1 }) do
		part(m, { Name = "PilotEye", Shape = Enum.PartType.Ball, Size = Vector3.new(0.7, 0.9, 0.4), Color = C.Dark, CanCollide = false, CFrame = at * CFrame.new(side * 0.45, 2.1, -0.95) })
	end
	for i = 0, 9 do
		local a = i / 10 * math.pi * 2
		part(m, { Name = "RimLight", Shape = Enum.PartType.Ball, Size = Vector3.new(0.8, 0.8, 0.8), Color = (i % 2 == 0) and C.Orange or C.Blue, Material = Enum.Material.Neon, CanCollide = false,
			CFrame = at * CFrame.new(math.cos(a) * 7.4, 0, math.sin(a) * 7.4) })
	end
	local under = part(m, { Name = "Underglow", Shape = Enum.PartType.Cylinder, Size = Vector3.new(0.3, 5, 5), Color = Color3.fromRGB(140, 255, 190), Material = Enum.Material.Neon, CanCollide = false,
		CFrame = at * CFrame.new(0, -1, 0) * CFrame.Angles(0, 0, math.rad(90)) })
	glow(under, Color3.fromRGB(140, 255, 190), 26, 2)
	local h = at.Position.Y - beamTo.Y
	part(m, { Name = "TractorBeam", Shape = Enum.PartType.Cylinder, Size = Vector3.new(h, 6, 6), Color = Color3.fromRGB(140, 255, 190), Material = Enum.Material.Neon, Transparency = 0.82,
		CanCollide = false, CanQuery = false, CastShadow = false, CFrame = CFrame.new(at.Position.X, beamTo.Y + h / 2, at.Position.Z) * CFrame.Angles(0, 0, math.rad(90)) })
	m.PrimaryPart = disc
	m:SetAttribute("SpinSpeed", 30)
	m:SetAttribute("Bob", 1.2)
end

local function fuelTanks(folder, at)
	for i, offset in ipairs({ -7, 0, 7 }) do
		local base = at * CFrame.new(offset, 0, 0)
		part(folder, { Name = "Tank", Shape = Enum.PartType.Cylinder, Size = Vector3.new(14, 6, 6), Color = (i == 2) and C.Orange or C.Trim, CFrame = base * CFrame.new(0, 7, 0) * CFrame.Angles(0, 0, math.rad(90)) })
		part(folder, { Name = "TankBand", Shape = Enum.PartType.Cylinder, Size = Vector3.new(1, 6.3, 6.3), Color = C.Blue, Material = Enum.Material.Neon, CFrame = base * CFrame.new(0, 10, 0) * CFrame.Angles(0, 0, math.rad(90)) })
		local cap = part(folder, { Name = "TankCap", Size = Vector3.new(6, 3, 6), Color = METAL, CFrame = base * CFrame.new(0, 14, 0) })
		local m = Instance.new("SpecialMesh")
		m.MeshType = Enum.MeshType.Sphere
		m.Parent = cap
	end
end

local function crates(folder, at, seed)
	local rng = Random.new(seed)
	for i = 1, 7 do
		local x, z = rng:NextNumber(-6, 6), rng:NextNumber(-4, 4)
		local s = rng:NextNumber(3, 4.5)
		local y = (i > 4) and (s / 2 + 4) or s / 2
		local crate = part(folder, { Name = "Crate", Size = Vector3.new(s, s, s), Color = (i % 3 == 0) and C.Orange or METAL, Material = Enum.Material.DiamondPlate,
			CFrame = at * CFrame.new(x, y, z) * CFrame.Angles(0, rng:NextNumber(0, math.pi), 0) })
		part(folder, { Name = "CrateStripe", Size = Vector3.new(s + 0.1, 0.4, s + 0.1), Color = C.Blue, Material = Enum.Material.Neon, CFrame = crate.CFrame })
	end
end

local function satelliteDish(folder, at)
	part(folder, { Name = "DishMast", Size = Vector3.new(2, 14, 2), Color = METAL_DARK, CFrame = at * CFrame.new(0, 7, 0) })
	local dish = part(folder, { Name = "Dish", Size = Vector3.new(14, 3, 14), Color = C.Trim, CFrame = at * CFrame.new(0, 15, 0) * CFrame.Angles(math.rad(25), 0, 0) })
	local m = Instance.new("SpecialMesh")
	m.MeshType = Enum.MeshType.Sphere
	m.Parent = dish
	dish:SetAttribute("SpinSpeed", 8)
	local tip = part(folder, { Name = "DishTip", Shape = Enum.PartType.Ball, Size = Vector3.new(1.4, 1.4, 1.4), Color = C.Orange, Material = Enum.Material.Neon, CFrame = at * CFrame.new(0, 19, 0) })
	glow(tip, C.Orange, 10, 2)
end

-- ---------- outside: asteroids ----------
local function asteroids(folder)
	local rng = Random.new(365)
	for i = 1, 26 do
		local angle = rng:NextNumber(0, math.pi * 2)
		local dist = rng:NextNumber(260, 520)
		local pos = Vector3.new(math.cos(angle) * dist, rng:NextNumber(-20, 160), math.sin(angle) * dist)
		local s = rng:NextNumber(6, 24)
		local rock = Instance.new("Model")
		rock.Name = "Asteroid" .. i
		rock.Parent = folder
		local core = part(rock, { Name = "Core", Size = Vector3.new(s, s * rng:NextNumber(0.6, 1), s * rng:NextNumber(0.7, 1)), Color = Color3.fromRGB(110 + rng:NextInteger(0, 30), 100, 95), Material = Enum.Material.Slate,
			CanCollide = false, CFrame = CFrame.new(pos) * CFrame.Angles(rng:NextNumber(0, 3), rng:NextNumber(0, 3), 0) })
		for _ = 1, 3 do
			part(rock, { Name = "Lump", Size = Vector3.new(s, s, s) * rng:NextNumber(0.35, 0.6), Color = core.Color, Material = Enum.Material.Slate, CanCollide = false,
				CFrame = core.CFrame * CFrame.new(rng:NextNumber(-s / 3, s / 3), rng:NextNumber(-s / 3, s / 3), rng:NextNumber(-s / 3, s / 3)) * CFrame.Angles(rng:NextNumber(0, 3), rng:NextNumber(0, 3), 0) })
		end
		rock.PrimaryPart = core
		rock:SetAttribute("SpinSpeed", rng:NextNumber(-12, 12))
	end
end

-- ---------- hiding lockers for Black Hole Night ----------
local function locker(folder, at)
	local m = Instance.new("Model")
	m.Name = "Locker"
	m.Parent = folder
	local body = part(m, { Name = "LockerBody", Size = Vector3.new(4.6, 9, 3.6), Color = Color3.fromRGB(96, 110, 150), Material = Enum.Material.Metal, CFrame = at * CFrame.new(0, 4.5, 0) })
	part(m, { Name = "Door", Size = Vector3.new(4.0, 8.2, 0.3), Color = Color3.fromRGB(110, 126, 170), Material = Enum.Material.Metal, CFrame = at * CFrame.new(0, 4.5, -1.9) })
	for i = 1, 3 do
		part(m, { Name = "Vent", Size = Vector3.new(2.4, 0.25, 0.1), Color = C.Dark, Material = Enum.Material.SmoothPlastic, CFrame = at * CFrame.new(0, 7 + i * 0.5, -2.06) })
	end
	local strip = part(m, { Name = "DoorLight", Size = Vector3.new(0.3, 6, 0.1), Color = C.Blue, Material = Enum.Material.Neon, CFrame = at * CFrame.new(1.6, 4.5, -2.08) })
	part(m, { Name = "Handle", Size = Vector3.new(0.3, 1.2, 0.3), Color = C.Orange, Material = Enum.Material.Neon, CFrame = at * CFrame.new(-1.4, 4.5, -2.15) })
	m.PrimaryPart = body
	return { model = m, body = body, strip = strip, inside = at * CFrame.new(0, 3.2, 0), front = at * CFrame.new(0, 3.2, -5) }
end

local function lockers(folder)
	local f = Instance.new("Folder")
	f.Name = "Lockers"
	f.Parent = folder
	local list = {}
	local spots = {}
	for _, x in ipairs({ -114, 0, 114 }) do -- in the gaps between bases
		for _, z in ipairs({ -95, 95 }) do
			table.insert(spots, Vector3.new(x - 3, 0, z))
			table.insert(spots, Vector3.new(x + 3, 0, z))
		end
	end
	for _, z in ipairs({ -40, 40 }) do
		table.insert(spots, Vector3.new(-140, 0, z))
		table.insert(spots, Vector3.new(140, 0, z * 0.75))
	end
	for _, p in ipairs(spots) do
		local facing = CFrame.lookAt(p, Vector3.new(p.X, 0, 0)) -- doors face the middle of the station
		table.insert(list, locker(f, facing))
	end
	return list
end

local function colour()
	local cc = Instance.new("ColorCorrectionEffect")
	cc.Saturation = 0.2
	cc.Contrast = 0.06
	cc.Brightness = 0.06
	cc.Parent = Lighting
end

function Decor.build(station, bases)
	local folder = Instance.new("Folder")
	folder.Name = "Decor"
	folder.Parent = station
	shell(folder)
	plating(folder)
	launchPad(folder)
	for _, base in ipairs(bases) do
		hangar(folder, base)
	end
	local rockets = {
		rocket(folder, CFrame.new(-160, 0, 0) * CFrame.Angles(0, math.rad(-90), 0), 1, true), -- front (name, windows) toward the spawn
		rocket(folder, CFrame.new(200, 0, 0) * CFrame.Angles(0, math.rad(90), 0), 0.65, false),
	}
	local stands = gearBay(folder, CFrame.lookAt(Vector3.new(0, 0, -48), Vector3.new(0, 0, 0))) -- beside the tunnel, open side facing it
	local roverModel = rover(folder, CFrame.new(-104, 0, -46) * CFrame.Angles(0, math.rad(25), 0))
	ufo(folder, CFrame.new(165, 22, 45), Vector3.new(165, 0, 45))
	fuelTanks(folder, CFrame.new(-150, 0, 40) * CFrame.Angles(0, math.rad(90), 0))
	crates(folder, CFrame.new(-150, 0, -40), 1)
	crates(folder, CFrame.new(165, 0, 45), 2)
	crates(folder, CFrame.new(165, 0, -45), 3)
	satelliteDish(folder, CFrame.new(160, 0, 0))
	asteroids(folder)
	colour()
	return lockers(folder), stands, roverModel, rockets
end

return Decor
