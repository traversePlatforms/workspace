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
	Lighting.Brightness = 1.2
	Lighting.Ambient = Color3.fromRGB(70, 80, 115)
	Lighting.OutdoorAmbient = Color3.fromRGB(90, 100, 140)
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
	-- low glass walls at the back and sides, open at the front
	part(root, { Name = "WallBack", Size = Vector3.new(W, 7, 1), Color = C.Blue, Material = Enum.Material.Glass, Transparency = 0.55, CFrame = cf * CFrame.new(0, 4.5, D / 2 + 0.5) })
	for _, side in ipairs({ -1, 1 }) do
		part(root, { Name = "WallSide", Size = Vector3.new(1, 7, D), Color = C.Blue, Material = Enum.Material.Glass, Transparency = 0.55, CFrame = cf * CFrame.new(side * (W / 2 + 0.5), 4.5, 0) })
	end
	-- the airlock shield across the whole front: visible only while it is on
	local shield = part(root, { Name = "Shield", Size = Vector3.new(W, 12, 1), Color = C.Blue, Material = Enum.Material.ForceField, Transparency = 1, CanCollide = false, CanQuery = false, CFrame = cf * CFrame.new(0, 6.5, -D / 2) })
	-- the owner's name on the back wall and floating over the entrance
	local signPart = part(root, { Name = "Sign", Size = Vector3.new(30, 5, 0.6), Color = C.Dark, CFrame = cf * CFrame.new(0, 10.5, D / 2 + 0.5) })
	local signLabel = surfaceText(signPart, Enum.NormalId.Front, "Free base", C.Orange, 30)
	local nameLabel = billboard(root, (cf * CFrame.new(0, 16, -D / 2)).Position, "Free base", C.Blue, 420, 80)
	-- eight pedestals in two rows at the back half
	local pedestals = {}
	local i = 0
	for _, z in ipairs({ 6, 15 }) do
		for _, x in ipairs({ -18, -6, 6, 18 }) do
			i += 1
			local base = cf * CFrame.new(x, 1, z)
			part(root, { Name = "Pedestal" .. i, Shape = Enum.PartType.Cylinder, Size = Vector3.new(2, 7, 7), Color = C.Trim, CFrame = base * CFrame.new(0, 1, 0) * CFrame.Angles(0, 0, math.rad(90)) })
			part(root, { Name = "PedestalRing" .. i, Shape = Enum.PartType.Cylinder, Size = Vector3.new(0.3, 7.4, 7.4), Color = C.Blue, Material = Enum.Material.Neon, CFrame = base * CFrame.new(0, 0.3, 0) * CFrame.Angles(0, 0, math.rad(90)) })
			pedestals[i] = { top = base * CFrame.new(0, 2, 0) }   -- critters face the entrance
		end
	end
	-- the airlock console just inside the entrance
	local console = part(root, { Name = "AirlockConsole", Size = Vector3.new(3, 4, 2), Color = C.Blue, Material = Enum.Material.SmoothPlastic, CFrame = cf * CFrame.new(-W / 2 + 4, 3, -D / 2 + 5) })
	part(root, { Name = "ConsoleScreen", Size = Vector3.new(2.6, 1.4, 0.2), Color = C.Orange, Material = Enum.Material.Neon, CFrame = console.CFrame * CFrame.new(0, 1.2, -1.05) })
	local prompt = Instance.new("ProximityPrompt")
	prompt.ActionText = "Close Airlock"
	prompt.ObjectText = "Airlock Shield"
	prompt.HoldDuration = 0.2
	prompt.MaxActivationDistance = 10
	prompt.RequiresLineOfSight = false
	prompt.Parent = console
	return {
		index = index, root = root, cf = cf, halfW = W / 2, halfD = D / 2,
		shield = shield, signLabel = signLabel, nameLabel = nameLabel,
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
	-- Hammy sits at the Commander's feet
	local hammy = Config.critterById("hammy")
	if hammy then
		local cat = CritterModels.build(hammy, at * CFrame.new(4.5, 5.6, -3) * CFrame.Angles(0, math.rad(200), 0))
		cat.Name = "HammyStatue"
		local tag = cat.PrimaryPart:FindFirstChild("Tag")
		if tag then
			tag:Destroy()
		end
		cat.Parent = m
	end
	return m
end

-- returns everything the game logic needs to know about the map
function MapBuilder.build()
	setupSky()
	local station = Instance.new("Folder")
	station.Name = "Station"
	station.Parent = workspace
	part(station, { Name = "Deck", Size = Vector3.new(380, 2, 270), Color = C.Deck, Material = Enum.Material.DiamondPlate, CFrame = CFrame.new(0, -1, 0) })
	for _, z in ipairs({ -45, 45 }) do
		part(station, { Name = "DeckLine", Size = Vector3.new(380, 0.2, 1), Color = C.Blue, Material = Enum.Material.Neon, CFrame = CFrame.new(0, 0.1, z) })
	end

	-- the critter launch pad: a moving walkway down the middle
	local padStart, padEnd, padY = -64, 64, 1
	part(station, { Name = "LaunchPad", Size = Vector3.new(padEnd - padStart + 6, 1, 12), Color = C.Dark, CFrame = CFrame.new(0, 0.5, 0) })
	for _, z in ipairs({ -6.4, 6.4 }) do
		part(station, { Name = "PadLight", Size = Vector3.new(padEnd - padStart + 6, 0.4, 0.6), Color = C.Blue, Material = Enum.Material.Neon, CFrame = CFrame.new(0, 1.2, z) })
	end
	part(station, { Name = "LaunchTube", Shape = Enum.PartType.Cylinder, Size = Vector3.new(8, 14, 14), Color = C.Orange, Material = Enum.Material.Neon, Transparency = 0.35, CanCollide = false, CFrame = CFrame.new(padStart - 2, 5, 0) })
	billboard(station, Vector3.new(0, 22, 0), "CRITTER LAUNCH PAD", C.Blue, 520, 70)
	billboard(station, Vector3.new(0, 48, 0), Config.GameTitle, C.Orange, 900, 130)

	local bases = {}
	local i = 0
	for _, row in ipairs({ { z = 82, rot = 0 }, { z = -82, rot = math.pi } }) do
		for _, x in ipairs({ -110, 0, 110 }) do
			i += 1
			bases[i] = buildBase(station, i, Vector3.new(x, 0, row.z), row.rot)
		end
	end

	commanderStatue(station, CFrame.new(118, 0, 0) * CFrame.Angles(0, math.rad(-90), 0))

	local spawn = Instance.new("SpawnLocation")
	spawn.Name = "Spawn"
	spawn.Anchored = true
	spawn.Size = Vector3.new(12, 1, 12)
	spawn.CFrame = CFrame.new(-112, 0.5, 0)
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

	return { bases = bases, padStart = padStart, padEnd = padEnd, padY = padY, critterFolder = critters }
end

return MapBuilder
