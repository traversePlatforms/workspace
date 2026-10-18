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

-- ---------- the deck: panel seams and walkway edging ----------
local function plating(folder)
	for x = -W / 2 + 20, W / 2 - 20, 20 do
		part(folder, { Name = "Seam", Size = Vector3.new(0.3, 0.05, D), Color = METAL_DARK, Material = Enum.Material.SmoothPlastic, CanCollide = false, CastShadow = false, CFrame = CFrame.new(x, 0.03, 0) })
	end
	for z = -D / 2 + 20, D / 2 - 20, 20 do
		part(folder, { Name = "Seam", Size = Vector3.new(W, 0.05, 0.3), Color = METAL_DARK, Material = Enum.Material.SmoothPlastic, CanCollide = false, CastShadow = false, CFrame = CFrame.new(0, 0.03, z) })
	end
end

-- ---------- the launch pad: hazard stripes, arrows, glass dome, hologram ----------
local function launchPad(folder)
	for x = -66, 66, 4 do
		local color = ((x / 4) % 2 == 0) and HAZARD or C.Dark
		for _, z in ipairs({ -7.6, 7.6 }) do
			part(folder, { Name = "Hazard", Size = Vector3.new(4, 0.2, 1.6), Color = color, Material = Enum.Material.SmoothPlastic, CanCollide = false, CFrame = CFrame.new(x, 0.11, z) })
		end
	end
	for x = -54, 54, 18 do -- chevrons pointing the way the pad moves
		for _, side in ipairs({ -1, 1 }) do
			part(folder, { Name = "Arrow", Size = Vector3.new(0.6, 0.12, 4.2), Color = C.Orange, Material = Enum.Material.Neon, CanCollide = false, CastShadow = false,
				CFrame = CFrame.new(x, 1.06, side * 1.4) * CFrame.Angles(0, side * math.rad(-40), 0) })
		end
	end
	-- the dome: half a glass egg over the pad
	local dome = part(folder, { Name = "Dome", Size = Vector3.new(160, 46, 52), Color = C.Blue, Material = Enum.Material.Glass, Transparency = 0.86, CanCollide = false, CanQuery = false, CastShadow = false, CFrame = CFrame.new(0, 0, 0) })
	local mesh = Instance.new("SpecialMesh")
	mesh.MeshType = Enum.MeshType.Sphere
	mesh.Parent = dome
	for _, x in ipairs({ -76, 76 }) do
		part(folder, { Name = "DomeRing", Shape = Enum.PartType.Cylinder, Size = Vector3.new(1.2, 46, 46), Color = C.Orange, Material = Enum.Material.Neon, CanCollide = false, Transparency = 0.2, CFrame = CFrame.new(x, 0, 0) })
	end
	-- the hologram planet floating over the middle of the pad
	local holo = part(folder, { Name = "HoloPlanet", Shape = Enum.PartType.Ball, Size = Vector3.new(9, 9, 9), Color = C.Blue, Material = Enum.Material.ForceField, CanCollide = false, CastShadow = false, CFrame = CFrame.new(0, 14, 0) })
	holo:SetAttribute("SpinSpeed", 25)
	glow(holo, C.Blue, 24, 2)
	local ring = part(folder, { Name = "HoloRing", Shape = Enum.PartType.Cylinder, Size = Vector3.new(0.3, 16, 16), Color = C.Orange, Material = Enum.Material.Neon, Transparency = 0.3, CanCollide = false, CastShadow = false, CFrame = CFrame.new(0, 14, 0) * CFrame.Angles(0, 0, math.rad(80)) })
	ring:SetAttribute("SpinSpeed", -40)
	part(folder, { Name = "HoloBase", Shape = Enum.PartType.Cylinder, Size = Vector3.new(1, 6, 6), Color = METAL, CFrame = CFrame.new(0, 1.4, 9.5) * CFrame.Angles(0, 0, math.rad(90)) })
end

-- ---------- bases: pillars, a roof with light trim, an entrance arch, wall lights ----------
local function hangar(folder, base)
	local cf, hw, hd = base.cf, base.halfW, base.halfD
	for _, sx in ipairs({ -1, 1 }) do
		for _, sz in ipairs({ -1, 1 }) do
			part(folder, { Name = "BasePillar", Size = Vector3.new(2.4, 14, 2.4), Color = METAL_DARK, CFrame = cf * CFrame.new(sx * hw, 7, sz * hd) })
		end
	end
	-- roof over the pedestals (the back half) with an orange edge
	part(folder, { Name = "BaseRoof", Size = Vector3.new(hw * 2 + 3, 1, hd + 4), Color = METAL, CFrame = cf * CFrame.new(0, 14.5, hd / 2) })
	part(folder, { Name = "BaseRoofEdge", Size = Vector3.new(hw * 2 + 3.4, 0.6, 0.8), Color = C.Orange, Material = Enum.Material.Neon, CFrame = cf * CFrame.new(0, 14.2, -1.6) })
	for i = -2, 2 do -- strip lights under the roof
		local strip = part(folder, { Name = "BaseRoofLight", Size = Vector3.new(0.6, 0.3, hd - 2), Color = C.Blue, Material = Enum.Material.Neon, CastShadow = false, CFrame = cf * CFrame.new(i * 10, 13.9, hd / 2) })
		if i == 0 then
			glow(strip, C.Blue, 30, 1.2)
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
end

return Decor
