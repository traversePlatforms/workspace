-- Builds the whole station from code when the server starts: deck, launch pad, six bases, the Commander statue, sky.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Lighting = game:GetService("Lighting")
local Config = require(ReplicatedStorage.Shared.Config)
local CritterModels = require(ReplicatedStorage.Shared.CritterModels)

local C = Config.Colors
local MapBuilder = {}

local function part(parent, props)
	local p = Instance.new(props.ClassName or "Part")
	p.Anchored = true
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.Material = Enum.Material.SmoothPlastic
	for k, v in pairs(props) do
		if k ~= "ClassName" then
			p[k] = v
		end
	end
	p.Parent = parent
	return p
end

local function surfaceText(target, face, text, color, size)
	local g = Instance.new("SurfaceGui")
	g.Face = face
	g.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
	g.PixelsPerStud = size or 40
	g.LightInfluence = 0
	g.Parent = target
	local l = Instance.new("TextLabel")
	l.Name = "Label"
	l.Size = UDim2.fromScale(1, 1)
	l.BackgroundTransparency = 1
	l.Font = Enum.Font.FredokaOne
	l.TextScaled = true
	l.TextColor3 = color
	l.Text = text
	l.Parent = g
	return l
end

local function billboard(parent, offset, text, color, w, h)
	local holder = part(parent, { Name = "BillboardHolder", Size = Vector3.new(1, 1, 1), Transparency = 1, CanCollide = false, CanQuery = false, CanTouch = false, CFrame = CFrame.new(offset) })
	local g = Instance.new("BillboardGui")
	g.Size = UDim2.fromOffset(w or 600, h or 120)
	g.LightInfluence = 0
	g.MaxDistance = 500
	g.Parent = holder
	local l = Instance.new("TextLabel")
	l.Name = "Label"
	l.Size = UDim2.fromScale(1, 1)
	l.BackgroundTransparency = 1
	l.Font = Enum.Font.FredokaOne
	l.TextScaled = true
	l.TextColor3 = color
	l.TextStrokeTransparency = 0.2
	l.Text = text
	l.Parent = g
	return l, holder
end

local function setupSky()
	Lighting.ClockTime = 0
	Lighting.Brightness = 2 -- brighter (2026-10-18, Matthew)
	Lighting.Ambient = Color3.fromRGB(122, 130, 168)
	Lighting.OutdoorAmbient = Color3.fromRGB(140, 150, 190)
	Lighting.ExposureCompensation = 0.25
	Lighting.GlobalShadows = true
	Lighting.FogEnd = 100000
	for _, c in ipairs(Lighting:GetChildren()) do
		if c:IsA("Sky") or c:IsA("Atmosphere") then
			c:Destroy()
		end
	end
	local sky = Instance.new("Sky")
	sky.StarCount = 5000
	sky.CelestialBodiesShown = false
	sky.Parent = Lighting
	local bloom = Instance.new("BloomEffect")
	bloom.Intensity = 0.6
	bloom.Size = 30
	bloom.Threshold = 1.4
	bloom.Parent = Lighting
end

local function planets(folder)
	part(folder, { Name = "OrangePlanet", Shape = Enum.PartType.Ball, Size = Vector3.new(160, 160, 160), Color = C.Orange, Material = Enum.Material.Neon, CFrame = CFrame.new(-420, 160, 380), CanCollide = false })
	local blue = part(folder, { Name = "BluePlanet", Shape = Enum.PartType.Ball, Size = Vector3.new(110, 110, 110), Color = C.Blue, Material = Enum.Material.Neon, CFrame = CFrame.new(460, 120, -360), CanCollide = false })
	part(folder, { Name = "Ring", Shape = Enum.PartType.Cylinder, Size = Vector3.new(2, 220, 220), Color = C.Trim, Material = Enum.Material.Neon, Transparency = 0.4, CFrame = blue.CFrame * CFrame.Angles(0, 0, math.rad(80)) * CFrame.Angles(math.rad(15), 0, 0), CanCollide = false })
	part(folder, { Name = "Moon", Shape = Enum.PartType.Ball, Size = Vector3.new(50, 50, 50), Color = Color3.fromRGB(205, 205, 215), Material = Enum.Material.Slate, CFrame = CFrame.new(150, 140, 420), CanCollide = false })

	-- more space out the windows (2026-10-18, Matthew: "a little more space related things"): Earth, Mars, a striped giant
	local function blob(parent, center, radius, dir, size, color, material, transparency)
		local p = part(parent, { Name = "Patch", Size = size, Color = color, Material = material or Enum.Material.SmoothPlastic, Transparency = transparency or 0, CanCollide = false, CastShadow = false,
			CFrame = CFrame.lookAt(center, center + dir) * CFrame.new(0, 0, -(radius - size.Z * 0.3)) })
		local mesh = Instance.new("SpecialMesh")
		mesh.MeshType = Enum.MeshType.Sphere
		mesh.Parent = p
		return p
	end
	local rng = Random.new(2026)
	local earthAt, er = Vector3.new(-90, 75, -520), 70
	part(folder, { Name = "Earth", Shape = Enum.PartType.Ball, Size = Vector3.new(er * 2, er * 2, er * 2), Color = Color3.fromRGB(40, 110, 225), CFrame = CFrame.new(earthAt), CanCollide = false })
	for _ = 1, 9 do -- green and sandy continents, then white clouds, mostly on the side facing the station
		local dir = (Vector3.new(rng:NextNumber(-1, 1), rng:NextNumber(-0.8, 0.8), rng:NextNumber(0.2, 1))).Unit
		blob(folder, earthAt, er, dir, Vector3.new(rng:NextNumber(28, 52), rng:NextNumber(20, 40), 10), rng:NextNumber() < 0.75 and Color3.fromRGB(70, 170, 80) or Color3.fromRGB(210, 190, 120))
	end
	for _ = 1, 8 do
		local dir = (Vector3.new(rng:NextNumber(-1, 1), rng:NextNumber(-1, 1), rng:NextNumber(0, 1))).Unit
		blob(folder, earthAt, er + 2, dir, Vector3.new(rng:NextNumber(24, 44), rng:NextNumber(6, 12), 6), Color3.fromRGB(250, 252, 255), Enum.Material.SmoothPlastic, 0.15)
	end
	part(folder, { Name = "EarthGlow", Shape = Enum.PartType.Ball, Size = Vector3.new(er * 2 + 8, er * 2 + 8, er * 2 + 8), Color = Color3.fromRGB(150, 210, 255), Material = Enum.Material.Neon, Transparency = 0.88, CFrame = CFrame.new(earthAt), CanCollide = false })

	local marsAt, mr = Vector3.new(540, 50, 140), 34
	part(folder, { Name = "Mars", Shape = Enum.PartType.Ball, Size = Vector3.new(mr * 2, mr * 2, mr * 2), Color = Color3.fromRGB(205, 92, 58), Material = Enum.Material.Slate, CFrame = CFrame.new(marsAt), CanCollide = false })
	for _ = 1, 7 do
		local dir = (Vector3.new(rng:NextNumber(-1, 0), rng:NextNumber(-0.8, 0.8), rng:NextNumber(-1, 1))).Unit
		blob(folder, marsAt, mr, dir, Vector3.new(rng:NextNumber(6, 14), rng:NextNumber(6, 14), 3), Color3.fromRGB(150, 62, 40), Enum.Material.Slate)
	end
	blob(folder, marsAt, mr + 0.5, Vector3.new(0, 1, 0), Vector3.new(26, 26, 4), Color3.fromRGB(245, 245, 250)) -- the ice cap

	-- the striped giant: thin discs a touch wider than the planet at each height show as bands round it
	local gasAt, gr = Vector3.new(-560, 110, -120), 95
	part(folder, { Name = "GasGiant", Shape = Enum.PartType.Ball, Size = Vector3.new(gr * 2, gr * 2, gr * 2), Color = Color3.fromRGB(226, 196, 150), CFrame = CFrame.new(gasAt), CanCollide = false })
	local bands = { Color3.fromRGB(196, 140, 96), Color3.fromRGB(240, 222, 190), Color3.fromRGB(176, 120, 84), Color3.fromRGB(232, 206, 160) }
	for i, y in ipairs({ -60, -38, -16, 8, 30, 52, 70 }) do
		local r = math.sqrt(gr * gr - y * y) + 0.8
		part(folder, { Name = "Band", Shape = Enum.PartType.Cylinder, Size = Vector3.new(9, r * 2, r * 2), Color = bands[(i - 1) % #bands + 1], CanCollide = false, CastShadow = false,
			CFrame = CFrame.new(gasAt + Vector3.new(0, y, 0)) * CFrame.Angles(0, 0, math.rad(90)) })
	end
	blob(folder, gasAt, gr + 1.5, Vector3.new(1, -0.25, 0.35).Unit, Vector3.new(34, 18, 6), Color3.fromRGB(200, 90, 60)) -- the big red spot
end

-- a base faces the launch pad: its front (local -Z) points at z = 0
local function buildBase(folder, index, position, facingRotation)
	local root = Instance.new("Model")
	root.Name = "Base" .. index
	root:SetAttribute("BaseIndex", index)
	root:SetAttribute("OwnerUserId", 0)
	root:SetAttribute("ShieldUntil", 0)
	root:SetAttribute("CooldownUntil", 0)
	root.Parent = folder
	local cf = CFrame.new(position) * CFrame.Angles(0, facingRotation, 0)
	local W, D = 56, 44
	local floor = part(root, { Name = "Floor", Size = Vector3.new(W, 1, D), Color = C.DeckLine, CFrame = cf * CFrame.new(0, 0.5, 0) })
	root.PrimaryPart = floor
	-- orange edge lights, with a gap at the entrance
	part(root, { Name = "EdgeBack", Size = Vector3.new(W, 0.3, 0.6), Color = C.Orange, Material = Enum.Material.Neon, CFrame = cf * CFrame.new(0, 1.1, D / 2) })
	for _, side in ipairs({ -1, 1 }) do
		part(root, { Name = "EdgeSide", Size = Vector3.new(0.6, 0.3, D), Color = C.Orange, Material = Enum.Material.Neon, CFrame = cf * CFrame.new(side * W / 2, 1.1, 0) })
		part(root, { Name = "EdgeFront", Size = Vector3.new((W - 18) / 2, 0.3, 0.6), Color = C.Orange, Material = Enum.Material.Neon, CFrame = cf * CFrame.new(side * (W / 4 + 4.5), 1.1, -D / 2) })
	end
	-- solid walls up to the roof (2026-10-18, Matthew: "the bases need some walls"): metal below, a window band above,
	-- and a front wall either side of an 18-stud doorway with big windows so friends can see your critters
	local WH, DOOR = 14, 18
	local metal, metalDark = Color3.fromRGB(128, 136, 156), Color3.fromRGB(72, 78, 98)
	local function wall(name, size, at, windowed)
		part(root, { Name = name, Size = Vector3.new(size.X, 6, size.Z), Color = metal, Material = Enum.Material.Metal, CFrame = at * CFrame.new(0, 3 + 1, 0) })
		part(root, { Name = name .. "Trim", Size = Vector3.new(size.X + 0.05, 0.5, size.Z + 0.1), Color = C.Orange, Material = Enum.Material.Neon, CFrame = at * CFrame.new(0, 7.2, 0) })
		if windowed then
			part(root, { Name = name .. "Window", Size = Vector3.new(size.X, WH - 8, size.Z * 0.5), Color = C.Blue, Material = Enum.Material.Glass, Transparency = 0.65, CastShadow = false, CFrame = at * CFrame.new(0, 7.5 + (WH - 8) / 2, 0) })
		else
			part(root, { Name = name .. "Upper", Size = Vector3.new(size.X, WH - 8, size.Z), Color = metalDark, Material = Enum.Material.Metal, CFrame = at * CFrame.new(0, 7.5 + (WH - 8) / 2, 0) })
		end
		part(root, { Name = name .. "Cap", Size = Vector3.new(size.X + 0.2, 0.8, size.Z + 0.3), Color = metalDark, Material = Enum.Material.Metal, CFrame = at * CFrame.new(0, WH + 1.4, 0) })
	end
	wall("WallBack", Vector3.new(W + 2, 0, 1.2), cf * CFrame.new(0, 0, D / 2 + 0.6), true)
	for _, side in ipairs({ -1, 1 }) do
		wall("WallSide", Vector3.new(1.2, 0, D + 2), cf * CFrame.new(side * (W / 2 + 0.6), 0, 0), side == 1)
		local segW = (W - DOOR) / 2 + 1
		wall("WallFront", Vector3.new(segW, 0, 1.2), cf * CFrame.new(side * (DOOR / 2 + segW / 2), 0, -D / 2 - 0.6), true)
	end
	-- light strips along the inside of the back wall
	part(root, { Name = "WallGlow", Size = Vector3.new(W - 4, 0.4, 0.3), Color = C.Blue, Material = Enum.Material.Neon, CFrame = cf * CFrame.new(0, 2.2, D / 2 - 0.1) })
	-- tiled floor with an orange border
	for tx = -2, 1 do
		for tz = -2, 1 do
			part(root, { Name = "FloorTile", Size = Vector3.new(W / 4 - 0.4, 0.1, D / 4 - 0.4), Color = ((tx + tz) % 2 == 0) and Color3.fromRGB(150, 158, 178) or Color3.fromRGB(138, 146, 166),
				Material = Enum.Material.Metal, CFrame = cf * CFrame.new((tx + 0.5) * W / 4, 1.05, (tz + 0.5) * D / 4) })
		end
	end
	-- the airlock shield fills the doorway: visible only while it is on
	-- the door (2026-10-18): an energy door, red and solid while locked, open (invisible, walk-through) while unlocked
	local shield = part(root, { Name = "Shield", Size = Vector3.new(DOOR, WH - 1, 1), Color = Color3.fromRGB(255, 70, 80), Material = Enum.Material.ForceField, Transparency = 1, CanCollide = false, CanQuery = false, CFrame = cf * CFrame.new(0, 1 + (WH - 1) / 2, -D / 2 - 0.6) })
	-- status lamps either side of the door: green = open, red = locked (Main.server.lua sets them)
	local lamps = {}
	for _, side in ipairs({ -1, 1 }) do
		table.insert(lamps, part(root, { Name = "DoorLamp", Shape = Enum.PartType.Ball, Size = Vector3.new(1.6, 1.6, 1.6), Color = Color3.fromRGB(80, 230, 120), Material = Enum.Material.Neon, CFrame = cf * CFrame.new(side * (DOOR / 2 + 2.2), 10, -D / 2 - 1.6) }))
	end
	-- the owner's name on the back wall and floating over the entrance
	local signPart = part(root, { Name = "Sign", Size = Vector3.new(30, 5, 0.6), Color = C.Dark, CFrame = cf * CFrame.new(0, 10.5, D / 2 + 0.5) })
	local signLabel = surfaceText(signPart, Enum.NormalId.Front, "Free base", C.Orange, 30)
	local nameLabel = billboard(root, (cf * CFrame.new(0, 16, -D / 2)).Position, "Free base", C.Blue, 420, 80)
	-- eight pedestals in two rows at the back half
	local pedestals = {}
	local i = 0
	for _, z in ipairs({ 6, 15, -4 }) do -- the third (front) row is the expansion: pedestals 9 to 12
		for _, x in ipairs({ -18, -6, 6, 18 }) do
			i += 1
			local base = cf * CFrame.new(x, 1, z)
			local ped = part(root, { Name = "Pedestal" .. i, Shape = Enum.PartType.Cylinder, Size = Vector3.new(2, 7, 7), Color = C.Trim, CFrame = base * CFrame.new(0, 1, 0) * CFrame.Angles(0, 0, math.rad(90)) })
			local ring = part(root, { Name = "PedestalRing" .. i, Shape = Enum.PartType.Cylinder, Size = Vector3.new(0.3, 7.4, 7.4), Color = C.Blue, Material = Enum.Material.Neon, CFrame = base * CFrame.new(0, 0.3, 0) * CFrame.Angles(0, 0, math.rad(90)) })
			pedestals[i] = { top = base * CFrame.new(0, 2, 0), part = ped, ring = ring }   -- critters face the entrance
		end
	end
	-- the airlock console just inside the entrance
	local console = part(root, { Name = "AirlockConsole", Size = Vector3.new(3, 4, 2), Color = C.Blue, Material = Enum.Material.SmoothPlastic, CFrame = cf * CFrame.new(-W / 2 + 4, 3, -D / 2 + 5) })
	part(root, { Name = "ConsoleScreen", Size = Vector3.new(2.6, 1.4, 0.2), Color = C.Orange, Material = Enum.Material.Neon, CFrame = console.CFrame * CFrame.new(0, 1.2, -1.05) })
	local prompt = Instance.new("ProximityPrompt")
	prompt.ActionText = "Lock / Unlock"
	prompt.ObjectText = "Base Door"
	prompt.HoldDuration = 0.2
	prompt.MaxActivationDistance = 10
	prompt.RequiresLineOfSight = false
	prompt.Parent = console
	return {
		index = index, root = root, cf = cf, halfW = W / 2, halfD = D / 2,
		unlocked = Config.PedestalsPerBase, -- pedestals this base can use (more after Expand Base)
		shield = shield, doorLamps = lamps, signLabel = signLabel, nameLabel = nameLabel,
		pedestals = pedestals, consolePrompt = prompt, slots = {}, owner = nil,
		shieldUntil = 0, cooldownUntil = 0,
	}
end

local function commanderStatue(folder, at)
	local m = Instance.new("Model")
	m.Name = "CommanderStatue"
	m.Parent = folder
	local base = part(m, { Name = "Plinth", Size = Vector3.new(14, 4, 14), Color = C.Trim, CFrame = at * CFrame.new(0, 2, 0) })
	local plaque = part(m, { Name = "Plaque", Size = Vector3.new(12, 3, 0.4), Color = C.Dark, CFrame = at * CFrame.new(0, 2, -7.2) })
	surfaceText(plaque, Enum.NormalId.Front, Config.CommanderName .. "\nStation Commander", C.Orange, 50)
	local suit, glass = C.Orange, C.Blue
	for _, side in ipairs({ -1, 1 }) do
		part(m, { Name = "Leg", Size = Vector3.new(1.8, 5, 2), Color = Color3.fromRGB(235, 235, 240), CFrame = at * CFrame.new(side * 1.1, 6.5, 0) })
		part(m, { Name = "Arm", Size = Vector3.new(1.6, 4.6, 1.8), Color = suit, CFrame = at * CFrame.new(side * 3.2, 11, 0) * CFrame.Angles(0, 0, side * 0.12) })
	end
	part(m, { Name = "Torso", Size = Vector3.new(4.6, 5, 2.4), Color = suit, CFrame = at * CFrame.new(0, 11.5, 0) })
	part(m, { Name = "Badge", Shape = Enum.PartType.Ball, Size = Vector3.new(1, 1, 1), Color = glass, Material = Enum.Material.Neon, CFrame = at * CFrame.new(-1.2, 12.6, -1.25) })
	part(m, { Name = "Helmet", Shape = Enum.PartType.Ball, Size = Vector3.new(4.4, 4.4, 4.4), Color = Color3.fromRGB(240, 240, 245), CFrame = at * CFrame.new(0, 16, 0) })
	part(m, { Name = "Visor", Size = Vector3.new(3, 1.8, 0.6), Color = glass, Material = Enum.Material.Glass, Transparency = 0.2, CFrame = at * CFrame.new(0, 16.2, -1.9) })
	-- Nolan's friends gather round the Commander: Hammy and Zuzu on the plinth, Matt and Sunny Sprout on the deck in front
	for _, spot in ipairs({ { "hammy", CFrame.new(4.6, 0, -3), 200 }, { "zuzu", CFrame.new(-4.6, 0, -3), 160 }, { "matt", CFrame.new(5, -4, -10), 190 }, { "sunnysprout", CFrame.new(-5, -4, -10), 170 } }) do
		local def = Config.critterById(spot[1])
		if def then
			local r = 1.5 * CritterModels.scaleFor(def)
			local friend = CritterModels.build(def, at * spot[2] * CFrame.new(0, 4 + r, 0) * CFrame.Angles(0, math.rad(spot[3]), 0))
			friend.Name = def.name .. "Statue"
			local tag = friend.PrimaryPart:FindFirstChild("Tag")
			if tag then
				tag.MaxDistance = 40
				local info = tag:FindFirstChild("Info")
				if info then
					info.Text = "Nolan's friend"
				end
			end
			friend.Parent = m
		end
	end
	return m
end

-- returns everything the game logic needs to know about the map
function MapBuilder.build()
	setupSky()
	local station = Instance.new("Folder")
	station.Name = "Station"
	station.Parent = workspace
	part(station, { Name = "Deck", Size = Vector3.new(460, 2, 300), Color = C.Deck, Material = Enum.Material.Metal, CFrame = CFrame.new(0, -1, 0) }) -- tiles and walkways go on top (Decor.lua)

	-- the critter launch pad: a moving walkway down the middle
	local padStart, padEnd, padY = -64, 64, 1
	part(station, { Name = "LaunchPad", Size = Vector3.new(padEnd - padStart + 6, 1, 12), Color = C.Dark, CFrame = CFrame.new(0, 0.5, 0) })
	for _, z in ipairs({ -6.4, 6.4 }) do
		part(station, { Name = "PadLight", Size = Vector3.new(padEnd - padStart + 6, 0.4, 0.6), Color = C.Blue, Material = Enum.Material.Neon, CFrame = CFrame.new(0, 1.2, z) })
	end
	billboard(station, Vector3.new(0, 33, 0), "CRITTER LAUNCH TUNNEL", C.Blue, 520, 70) -- the tunnel itself is built in Decor.lua
	billboard(station, Vector3.new(0, 48, 0), Config.GameTitle, C.Orange, 900, 130)

	local bases = {}
	local i = 0
	for _, row in ipairs({ { z = 95, rot = 0 }, { z = -95, rot = math.pi } }) do
		for _, x in ipairs({ -171, -57, 57, 171 }) do -- 8 bases (2026-10-18: bigger map)
			i += 1
			bases[i] = buildBase(station, i, Vector3.new(x, 0, row.z), row.rot)
		end
	end

	commanderStatue(station, CFrame.new(118, 0, 0) * CFrame.Angles(0, math.rad(-90), 0))

	local spawn = Instance.new("SpawnLocation")
	spawn.Name = "Spawn"
	spawn.Anchored = true
	spawn.Size = Vector3.new(12, 1, 12)
	spawn.CFrame = CFrame.new(-112, 0.5, 0) * CFrame.Angles(0, math.rad(-90), 0) -- you arrive facing the launch tunnel (2026-10-18)
	spawn.Color = C.Blue
	spawn.Material = Enum.Material.Neon
	spawn.Duration = 0
	spawn.Neutral = true
	spawn.Parent = station

	local deco = Instance.new("Folder")
	deco.Name = "Space"
	deco.Parent = station
	planets(deco)

	local critters = Instance.new("Folder")
	critters.Name = "Critters"
	critters.Parent = station

	local lockers, gearStands, rover = require(script.Parent.Decor).build(station, bases) -- the hangar shell, tunnel, props, asteroids and the hiding lockers (2026-10-18)

	return { bases = bases, padStart = padStart, padEnd = padEnd, padY = padY, critterFolder = critters, lockers = lockers, gearStands = gearStands, rover = rover }
end

return MapBuilder
