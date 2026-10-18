-- The station's looks (2026-10-18, Matthew: "it didn't look like much in a sense of the walls and the overall station"):
-- a hangar shell with windows and a roof frame, a glass dome over the launch pad, deck plating, proper hangar bases,
-- props (rocket, fuel tanks, crates, satellite dish), a hologram planet, and asteroids outside.
-- Anything with a "SpinSpeed" attribute is turned by the player's own screen (Spin.client.lua), so it costs the server nothing.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Lighting = game:GetService("Lighting")
local Config = require(ReplicatedStorage.Shared.Config)

local C = Config.Colors
local METAL = Color3.fromRGB(120, 128, 148)
local METAL_DARK = Color3.fromRGB(70, 76, 96)
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
local W, D, H = 380, 270, 34 -- deck size and wall height

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
		part(folder, { Name = "RoofCross", Size = Vector3.new(W, 2, 2), Color = METAL, CFrame = CFrame.new(0, H + 3.5, z) })
	end
	-- hanging lamps over the bases so the deck is lit
	for _, x in ipairs({ -110, 0, 110 }) do
		for _, z in ipairs({ -82, 82, -40, 40 }) do
			local lamp = part(folder, { Name = "Lamp", Size = Vector3.new(6, 1, 6), Color = C.Trim, Material = Enum.Material.Neon, CFrame = CFrame.new(x, H - 1, z) })
			local sl = Instance.new("SpotLight")
			sl.Face = Enum.NormalId.Bottom
			sl.Range = 45
			sl.Angle = 80
			sl.Brightness = 1.4
			sl.Color = Color3.fromRGB(255, 240, 220)
			sl.Parent = lamp
		end
	end
end

-- ---------- the deck: real floor tiles and walkways (2026-10-18, Matthew: "flooring needs to actually be floor") ----------
local TILE_A, TILE_B = Color3.fromRGB(112, 120, 142), Color3.fromRGB(102, 110, 132)
local WALK = Color3.fromRGB(160, 168, 188)

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
		walk(Vector3.new(-150, 0, z), Vector3.new(150, 0, z), 8)
	end
	for _, x in ipairs({ -110, 0, 110 }) do
		walk(Vector3.new(x, 0, 26), Vector3.new(x, 0, 58), 10)
		walk(Vector3.new(x, 0, -26), Vector3.new(x, 0, -58), 10)
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
local function rocket(folder, at)
	local m = Instance.new("Model")
	m.Name = "Rocket"
	m.Parent = folder
	part(m, { Name = "LaunchPadBase", Shape = Enum.PartType.Cylinder, Size = Vector3.new(1.5, 26, 26), Color = METAL_DARK, CFrame = at * CFrame.new(0, 0.75, 0) * CFrame.Angles(0, 0, math.rad(90)) })
	part(m, { Name = "Body", Shape = Enum.PartType.Cylinder, Size = Vector3.new(30, 9, 9), Color = C.Trim, Material = Enum.Material.SmoothPlastic, CFrame = at * CFrame.new(0, 17, 0) * CFrame.Angles(0, 0, math.rad(90)) })
	for _, y in ipairs({ 8, 26 }) do
		part(m, { Name = "Band", Shape = Enum.PartType.Cylinder, Size = Vector3.new(1.5, 9.3, 9.3), Color = C.Orange, Material = Enum.Material.SmoothPlastic, CFrame = at * CFrame.new(0, y, 0) * CFrame.Angles(0, 0, math.rad(90)) })
	end
	local nose = part(m, { Name = "Nose", Size = Vector3.new(9, 10, 9), Color = C.Orange, Material = Enum.Material.SmoothPlastic, CFrame = at * CFrame.new(0, 33, 0) })
	local nm = Instance.new("SpecialMesh")
	nm.MeshType = Enum.MeshType.Sphere
	nm.Parent = nose
	part(m, { Name = "Window", Shape = Enum.PartType.Ball, Size = Vector3.new(3.4, 3.4, 3.4), Color = C.Blue, Material = Enum.Material.Glass, Transparency = 0.2, CFrame = at * CFrame.new(0, 22, -3.6) })
	for i = 0, 3 do
		local a = math.rad(45 + i * 90)
		part(m, { ClassName = "WedgePart", Name = "Fin", Size = Vector3.new(0.8, 8, 5), Color = C.Blue, Material = Enum.Material.SmoothPlastic,
			CFrame = at * CFrame.Angles(0, a, 0) * CFrame.new(0, 6, -6.5) * CFrame.Angles(0, math.rad(180), 0) })
	end
	local engine = part(m, { Name = "Engine", Shape = Enum.PartType.Cylinder, Size = Vector3.new(2, 6, 6), Color = METAL_DARK, CFrame = at * CFrame.new(0, 2.5, 0) * CFrame.Angles(0, 0, math.rad(90)) })
	local fire = Instance.new("ParticleEmitter") -- a gentle idle glow under the engine
	fire.Color = ColorSequence.new(C.Orange, Color3.fromRGB(255, 90, 40))
	fire.LightEmission = 1
	fire.Size = NumberSequence.new(2.2, 0)
	fire.Lifetime = NumberRange.new(0.4, 0.7)
	fire.Rate = 30
	fire.Speed = NumberRange.new(4, 7)
	fire.EmissionDirection = Enum.NormalId.Left
	fire.Parent = engine
	glow(engine, C.Orange, 18, 2)
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
	for _, x in ipairs({ -56, 56 }) do
		for _, z in ipairs({ -82, 82 }) do
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
	cc.Saturation = 0.15
	cc.Contrast = 0.08
	cc.Brightness = 0.02
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
	rocket(folder, CFrame.new(-160, 0, 0))
	fuelTanks(folder, CFrame.new(-150, 0, 40) * CFrame.Angles(0, math.rad(90), 0))
	crates(folder, CFrame.new(-150, 0, -40), 1)
	crates(folder, CFrame.new(165, 0, 45), 2)
	crates(folder, CFrame.new(165, 0, -45), 3)
	satelliteDish(folder, CFrame.new(160, 0, 0))
	asteroids(folder)
	colour()
	return lockers(folder)
end

return Decor
