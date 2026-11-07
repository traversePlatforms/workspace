-- Builds Splash Lagoon, the water park (2026-11-07), far from the station: terrain ground and real terrain water (so everyone
-- swims the normal Roblox way), the slides, the cannonball tower, the splash pad and its tipping bucket, palms, and the hidden
-- rubber ducks. Every section is built inside its own pcall: a mistake in one part of the park only loses that part, and nothing
-- here can ever stop the station from loading. Where things go is in ReplicatedStorage.Shared.ParkLayout.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local L = require(ReplicatedStorage.Shared.ParkLayout)

local ParkBuilder = {}

local WHITE = Color3.fromRGB(250, 250, 252)
local SUN = Color3.fromRGB(255, 205, 70)
local AQUA = Color3.fromRGB(70, 200, 230)
local CORAL = Color3.fromRGB(255, 120, 100)
local LEAF = Color3.fromRGB(70, 175, 80)
local BARK = Color3.fromRGB(140, 100, 64)

local function part(parent, props)
	local p = Instance.new("Part")
	p.Anchored = true
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.Material = Enum.Material.SmoothPlastic
	for k, v in pairs(props) do
		p[k] = v
	end
	-- the iPad rule from the station: glowing, see-through, small and paper-thin pieces cast no shadow
	if props.CastShadow == nil then
		local sz = props.Size
		if props.Material == Enum.Material.Neon or (props.Transparency or 0) > 0 or (sz and (math.max(sz.X, sz.Y, sz.Z) < 2 or math.min(sz.X, sz.Y, sz.Z) <= 0.3)) then
			p.CastShadow = false
		end
	end
	p.Parent = parent
	return p
end

local UPRIGHT = CFrame.Angles(0, 0, math.rad(90)) -- turns a cylinder (its length runs along x) to stand up

local function surfaceText(target, face, text, color, ppS)
	local g = Instance.new("SurfaceGui")
	g.Face = face
	g.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
	g.PixelsPerStud = ppS or 30
	g.LightInfluence = 0
	g.Parent = target
	local l = Instance.new("TextLabel")
	l.Name = "Label"
	l.Size = UDim2.fromScale(1, 1)
	l.BackgroundTransparency = 1
	l.Font = Enum.Font.FredokaOne
	l.TextScaled = true
	l.TextColor3 = color
	l.TextStrokeTransparency = 0.4
	l.Text = text
	l.Parent = g
	return l
end

-- a floating sign like the station's: a rounded panel sized in studs, so it shrinks with distance
local function sign(parent, pos, text, color, w, h)
	local holder = part(parent, { Name = "SignHolder", Size = Vector3.new(1, 1, 1), Transparency = 1, CanCollide = false, CanQuery = false, CanTouch = false, CFrame = CFrame.new(pos) })
	local g = Instance.new("BillboardGui")
	g.Size = UDim2.fromScale(w or 18, h or 3.6)
	g.LightInfluence = 0
	g.MaxDistance = 320
	g.Parent = holder
	local panel = Instance.new("Frame")
	panel.Size = UDim2.fromScale(1, 1)
	panel.BackgroundColor3 = Color3.fromRGB(255, 255, 255)
	panel.BackgroundTransparency = 0.1
	panel.Parent = g
	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0.3, 0)
	corner.Parent = panel
	local stroke = Instance.new("UIStroke")
	stroke.Color = color
	stroke.Thickness = 3
	stroke.Parent = panel
	local l = Instance.new("TextLabel")
	l.AnchorPoint = Vector2.new(0.5, 0.5)
	l.Position = UDim2.fromScale(0.5, 0.5)
	l.Size = UDim2.fromScale(0.9, 0.78)
	l.BackgroundTransparency = 1
	l.Font = Enum.Font.FredokaOne
	l.TextScaled = true
	l.TextColor3 = color
	l.Text = text
	l.Parent = panel
	return l
end

-- ---------- terrain: the ground, sand, grass, and the water ----------
local function rectBlock(r, top, thick, material)
	local T = workspace.Terrain
	local cx, cz = (r.x1 + r.x2) / 2, (r.z1 + r.z2) / 2
	T:FillBlock(CFrame.new(L.at(cx, top - thick / 2, cz)), Vector3.new(r.x2 - r.x1, thick, r.z2 - r.z1), material)
end

local function terrain()
	local T = workspace.Terrain
	-- terrain colours and water looks are for the whole place, but the station has no terrain or water, so only the park shows them
	T:SetMaterialColor(Enum.Material.Concrete, Color3.fromRGB(238, 226, 204))
	T:SetMaterialColor(Enum.Material.Grass, Color3.fromRGB(112, 200, 92))
	T:SetMaterialColor(Enum.Material.Sand, Color3.fromRGB(242, 222, 164))
	T.WaterColor = Color3.fromRGB(40, 190, 230)
	T.WaterTransparency = 0.4
	T.WaterReflectance = 0.3
	T.WaterWaveSize = 0.12
	T.WaterWaveSpeed = 8
	-- the whole park's ground first, then grass and sand on top, then the water cut into it
	rectBlock({ x1 = -L.HalfX, x2 = L.HalfX, z1 = -L.HalfZ, z2 = L.HalfZ }, 0, L.GroundDepth, Enum.Material.Concrete)
	for _, g in ipairs({
		{ x1 = -184, x2 = -140, z1 = 24, z2 = 168 },
		{ x1 = -136, x2 = -24, z1 = 148, z2 = 168 },
		L.River.inner,
		{ x1 = -184, x2 = -168, z1 = -168, z2 = -24 },
		{ x1 = -136, x2 = -40, z1 = -168, z2 = -140 },
	}) do
		rectBlock(g, 0, 4, Enum.Material.Grass)
	end
	rectBlock(L.Beach, 0, 4, Enum.Material.Sand)
	-- water: the wave pool gets deeper away from the beach
	for _, b in ipairs(L.WaveBands) do
		rectBlock({ x1 = b.x1, x2 = b.x2, z1 = L.WavePool.z1, z2 = L.WavePool.z2 }, 0, b.depth, Enum.Material.Water)
	end
	local o, i, d = L.River.outer, L.River.inner, L.River.depth
	rectBlock({ x1 = o.x1, x2 = o.x2, z1 = o.z1, z2 = i.z1 }, 0, d, Enum.Material.Water)
	rectBlock({ x1 = o.x1, x2 = o.x2, z1 = i.z2, z2 = o.z2 }, 0, d, Enum.Material.Water)
	rectBlock({ x1 = o.x1, x2 = i.x1, z1 = i.z1, z2 = i.z2 }, 0, d, Enum.Material.Water)
	rectBlock({ x1 = i.x2, x2 = o.x2, z1 = i.z1, z2 = i.z2 }, 0, d, Enum.Material.Water)
	rectBlock(L.SplashPool, 0, L.SplashPool.depth, Enum.Material.Water)
end

-- a low tiled edge round a pool (the water is level with the deck, so this is only a colour line)
local function coping(folder, r, color, skipWest)
	local t, h = 1.6, 0.3
	local w, dz = r.x2 - r.x1, r.z2 - r.z1
	local cx, cz = (r.x1 + r.x2) / 2, (r.z1 + r.z2) / 2
	part(folder, { Name = "Edge", Size = Vector3.new(w + t * 2, h, t), Color = color, CanCollide = false, CFrame = CFrame.new(L.at(cx, h / 2, r.z1 - t / 2)) })
	part(folder, { Name = "Edge", Size = Vector3.new(w + t * 2, h, t), Color = color, CanCollide = false, CFrame = CFrame.new(L.at(cx, h / 2, r.z2 + t / 2)) })
	part(folder, { Name = "Edge", Size = Vector3.new(t, h, dz), Color = color, CanCollide = false, CFrame = CFrame.new(L.at(r.x2 + t / 2, h / 2, cz)) })
	if not skipWest then
		part(folder, { Name = "Edge", Size = Vector3.new(t, h, dz), Color = color, CanCollide = false, CFrame = CFrame.new(L.at(r.x1 - t / 2, h / 2, cz)) })
	end
end

-- ---------- the edge of the park: a hedge you can see, and walls you can't, up high ----------
local function boundary(folder)
	local hx, hz = L.HalfX, L.HalfZ
	for _, s in ipairs({ -1, 1 }) do
		part(folder, { Name = "Hedge", Size = Vector3.new(3, 4, hz * 2), Color = LEAF, Material = Enum.Material.Grass, CFrame = CFrame.new(L.at(s * (hx - 1.5), 2, 0)) })
		part(folder, { Name = "Hedge", Size = Vector3.new(hx * 2, 4, 3), Color = LEAF, Material = Enum.Material.Grass, CFrame = CFrame.new(L.at(0, 2, s * (hz - 1.5))) })
		part(folder, { Name = "InvisibleWall", Size = Vector3.new(2, 170, hz * 2 + 4), Transparency = 1, CanQuery = false, CastShadow = false, CFrame = CFrame.new(L.at(s * (hx + 1), 75, 0)) })
		part(folder, { Name = "InvisibleWall", Size = Vector3.new(hx * 2 + 4, 170, 2), Transparency = 1, CanQuery = false, CastShadow = false, CFrame = CFrame.new(L.at(0, 75, s * (hz + 1))) })
	end
end

-- ---------- palms, umbrellas, the welcome arch ----------
local function palm(folder, x, z, h)
	h = h or 14
	local m = Instance.new("Model")
	m.Name = "Palm"
	m.Parent = folder
	local base = L.at(x, 0, z)
	part(m, { Name = "Trunk", Shape = Enum.PartType.Cylinder, Size = Vector3.new(h, 1.6, 1.6), Color = BARK, Material = Enum.Material.Wood, CFrame = CFrame.new(base + Vector3.new(0, h / 2, 0)) * UPRIGHT })
	local top = base + Vector3.new(0, h, 0)
	for k = 0, 5 do
		part(m, { Name = "Leaf", Size = Vector3.new(2.4, 0.4, 8), Color = (k % 2 == 0) and LEAF or Color3.fromRGB(90, 195, 95), CanCollide = false,
			CFrame = CFrame.new(top) * CFrame.Angles(0, k * math.pi / 3, 0) * CFrame.Angles(-0.35, 0, 0) * CFrame.new(0, 0, -3.8) })
	end
	for k = 0, 2 do
		local a = k * math.pi * 2 / 3
		part(m, { Name = "Coconut", Shape = Enum.PartType.Ball, Size = Vector3.new(1.1, 1.1, 1.1), Color = Color3.fromRGB(110, 76, 46), CanCollide = false,
			CFrame = CFrame.new(top + Vector3.new(math.cos(a) * 0.8, -0.8, math.sin(a) * 0.8)) })
	end
end

local function umbrella(folder, x, z, color)
	local base = L.at(x, 0, z)
	part(folder, { Name = "UmbrellaPole", Shape = Enum.PartType.Cylinder, Size = Vector3.new(9, 0.5, 0.5), Color = WHITE, CFrame = CFrame.new(base + Vector3.new(0, 4.5, 0)) * UPRIGHT })
	part(folder, { Name = "Umbrella", Shape = Enum.PartType.Cylinder, Size = Vector3.new(0.6, 11, 11), Color = color, CanCollide = false, CFrame = CFrame.new(base + Vector3.new(0, 9, 0)) * UPRIGHT })
	part(folder, { Name = "Towel", Size = Vector3.new(3, 0.12, 6), Color = color, CanCollide = false, CFrame = CFrame.new(base + Vector3.new(2.8, 0.06, 0)) })
end

local function decor(folder)
	-- the welcome arch you walk through from where you arrive
	local ax = -148
	for _, s in ipairs({ -1, 1 }) do
		part(folder, { Name = "ArchPillar", Size = Vector3.new(3, 18, 3), Color = AQUA, CFrame = CFrame.new(L.at(ax, 9, s * 14)) })
	end
	local beam = part(folder, { Name = "ArchSign", Size = Vector3.new(3, 5, 34), Color = WHITE, CFrame = CFrame.new(L.at(ax, 19.5, 0)) })
	surfaceText(beam, Enum.NormalId.Left, L.Name, Color3.fromRGB(30, 150, 210), 24)
	surfaceText(beam, Enum.NormalId.Right, "Have a splashing time!", CORAL, 24)
	part(folder, { Name = "ArchStripe", Size = Vector3.new(3.2, 0.8, 34.2), Color = SUN, CFrame = CFrame.new(L.at(ax, 17.3, 0)) })
	-- where you arrive: a bright pad (not a SpawnLocation: a second one would change where people appear on the station)
	part(folder, { Name = "ArrivalPad", Shape = Enum.PartType.Cylinder, Size = Vector3.new(0.2, 14, 14), Color = AQUA, CanCollide = false, CFrame = CFrame.new(L.at(-160, 0.1, 0)) * UPRIGHT })
	-- a board beside the arch, facing you as you arrive, telling you what to do
	local board = part(folder, { Name = "HowToPlay", Size = Vector3.new(0.6, 8, 14), Color = WHITE, CFrame = CFrame.new(L.at(-152, 5, -28)) })
	surfaceText(board, Enum.NormalId.Left, "Ride the slides!\nGrab Splash Tokens for Stardust\nFind all " .. #L.Ducks .. " rubber ducks!", Color3.fromRGB(30, 150, 210), 20)
	part(folder, { Name = "BoardLeg", Size = Vector3.new(0.6, 1.2, 1), Color = AQUA, CFrame = CFrame.new(L.at(-152, 0.6, -33)) })
	part(folder, { Name = "BoardLeg", Size = Vector3.new(0.6, 1.2, 1), Color = AQUA, CFrame = CFrame.new(L.at(-152, 0.6, -23)) })
	-- palms along the paths, on the beach and on the river's island
	for _, p in ipairs({ { -128, 22 }, { -90, 22 }, { -50, 22 }, { -128, -22 }, { -90, -22 }, { -50, -22 }, { 2, 22 }, { 2, -24 },
		{ -160, -60, 16 }, { -158, -112, 13 }, { -90, 80, 12 }, { -68, 104, 15 }, { 48, 144 }, { 160, 40 }, { 172, -20 }, { -176, 100 } }) do
		palm(folder, p[1], p[2], p[3])
	end
	umbrella(folder, -152, -76, CORAL)
	umbrella(folder, -152, -96, SUN)
	umbrella(folder, -152, -120, AQUA)
	-- the wave machine at the deep end of the wave pool
	local wm = part(folder, { Name = "WaveMachine", Size = Vector3.new(4, 9, 60), Color = AQUA, CFrame = CFrame.new(L.at(-36, 4.5, -88)) })
	surfaceText(wm, Enum.NormalId.Left, "WAVE POOL", WHITE, 14)
	part(folder, { Name = "WaveMachineTop", Size = Vector3.new(4.4, 1, 60.4), Color = SUN, CFrame = CFrame.new(L.at(-36, 9.5, -88)) })
	-- coloured edges round the pools
	coping(folder, L.WavePool, WHITE, true)
	coping(folder, L.SplashPool, WHITE, false)
	coping(folder, L.River.outer, SUN, false)
	local i = L.River.inner -- the island edge sits on the island, not in the water
	coping(folder, { x1 = i.x1 + 1.6, x2 = i.x2 - 1.6, z1 = i.z1 + 1.6, z2 = i.z2 - 1.6 }, SUN, false)
	-- signs over the places to go
	sign(folder, L.at(-88, 18, -88), "WAVE POOL", Color3.fromRGB(30, 150, 210), 16, 3.4)
	sign(folder, L.at(-80, 20, 92), "LAZY RIVER", Color3.fromRGB(40, 160, 90), 16, 3.4)
	sign(folder, L.at(104, 44, 90), "SPLASH PAD", CORAL, 16, 3.4)
	sign(folder, L.at(92, 66, -34), "WATER SLIDES", Color3.fromRGB(150, 90, 230), 18, 3.6)
end

-- ---------- the slides: towers, open troughs to ride in, and a pad at the bottom to start ----------
local function slides(folder)
	local sf = Instance.new("Folder")
	sf.Name = "Slides"
	sf.Parent = folder
	for _, s in ipairs(L.Slides) do
		local ok, err = pcall(function()
			local m = Instance.new("Model")
			m.Name = s.id
			m.Parent = sf
			if s.tower and not s.noTower then
				local tw = s.tower
				local half = tw.w / 2
				part(m, { Name = "Core", Size = Vector3.new(tw.w * 0.5, tw.top, tw.w * 0.5), Color = s.color, CFrame = CFrame.new(L.at(tw.x, tw.top / 2, tw.z)) })
				for _, cx in ipairs({ -1, 1 }) do
					for _, cz in ipairs({ -1, 1 }) do
						part(m, { Name = "Post", Size = Vector3.new(1.6, tw.top + 6, 1.6), Color = WHITE, CFrame = CFrame.new(L.at(tw.x + cx * (half - 0.8), (tw.top + 6) / 2, tw.z + cz * (half - 0.8))) })
					end
				end
				part(m, { Name = "Platform", Size = Vector3.new(tw.w, 1, tw.w), Color = WHITE, CFrame = CFrame.new(L.at(tw.x, tw.top - 0.5, tw.z)) })
				part(m, { Name = "Roof", Size = Vector3.new(tw.w + 2, 0.8, tw.w + 2), Color = s.color2, CFrame = CFrame.new(L.at(tw.x, tw.top + 6.4, tw.z)) })
				for k = 1, math.floor(tw.top / 10) do -- coloured bands up the core
					part(m, { Name = "Band", Size = Vector3.new(tw.w * 0.5 + 0.3, 1.2, tw.w * 0.5 + 0.3), Color = s.color2, CFrame = CFrame.new(L.at(tw.x, k * 10, tw.z)) })
				end
			end
			-- the trough: a floor and two rails per piece, stripes in the slide's two colours. Nobody stands on it (your screen
			-- carries you down), so it doesn't collide: no snagging, no getting stuck on a seam.
			local pts = s.points
			for i = 1, #pts - 1 do
				local a, b = pts[i], pts[i + 1]
				local len = (b - a).Magnitude
				if len > 0.05 then
					local cf = CFrame.lookAt((a + b) / 2, b)
					local col = (i % 2 == 0) and s.color or s.color2
					part(m, { Name = "Trough", Size = Vector3.new(6, 0.6, len + 0.5), Color = col, CanCollide = false, CanQuery = false, CanTouch = false, CFrame = cf * CFrame.new(0, -0.3, 0) })
					for _, side in ipairs({ -1, 1 }) do
						part(m, { Name = "Rail", Size = Vector3.new(0.6, 1.8, len + 0.5), Color = s.color, CanCollide = false, CanQuery = false, CanTouch = false, CastShadow = false, CFrame = cf * CFrame.new(side * 3, 0.6, 0) })
					end
				end
				-- a support every few pieces, down to the deck or the pool floor, but never one that would poke up through a lower
				-- part of the same slide (the corkscrew passes over the same spot three times)
				local below = false
				for j = 1, #pts do
					local q = pts[j]
					if math.abs(j - i) > 3 and q.Y < a.Y - 6 and (Vector3.new(q.X - a.X, 0, q.Z - a.Z)).Magnitude < 5 then
						below = true
						break
					end
				end
				if i % 4 == 0 and a.Y > 4 and not below then
					local floorY = L.inSplashPool(Vector3.new(a.X, 0, a.Z)) and -L.SplashPool.depth or 0
					local h = (a.Y - 0.6) - L.Origin.Y - floorY
					if h > 1 then
						part(m, { Name = "Support", Size = Vector3.new(1.2, h, 1.2), Color = WHITE, CFrame = CFrame.new(Vector3.new(a.X, L.Origin.Y + floorY + h / 2, a.Z)) })
					end
				end
			end
			-- the pad at the bottom: stand on it and press Ride
			local pad = part(m, { Name = "RidePad_" .. s.id, Shape = Enum.PartType.Cylinder, Size = Vector3.new(0.3, 8, 8), Color = s.color, Material = Enum.Material.Neon, CanCollide = false,
				CFrame = CFrame.new(s.pad + Vector3.new(0, 0.15, 0)) * UPRIGHT })
			pad:SetAttribute("SlideId", s.id)
			sign(m, s.pad + Vector3.new(0, 8, 0), s.name, s.color, 14, 2.8)
		end)
		if not ok then
			warn("[Splash Lagoon] slide " .. tostring(s.id) .. " failed: " .. tostring(err))
		end
	end
end

-- ---------- the cannonball tower and the springboard ----------
local function cannonball(folder)
	local m = Instance.new("Model")
	m.Name = "CannonballTower"
	m.Parent = folder
	local c = L.Cannonball
	for _, cx in ipairs({ -1, 1 }) do
		for _, cz in ipairs({ -1, 1 }) do
			part(m, { Name = "Post", Size = Vector3.new(1.6, c.top + 4, 1.6), Color = WHITE, CFrame = CFrame.new(L.at(c.x + cx * 4.5, (c.top + 4) / 2, c.z + cz * 4.5)) })
		end
	end
	part(m, { Name = "Platform", Size = Vector3.new(10.6, 1, 10.6), Color = CORAL, CFrame = CFrame.new(L.at(c.x, c.top - 0.5, c.z)) })
	part(m, { Name = "MidPlatform", Size = Vector3.new(10.6, 1, 10.6), Color = SUN, CFrame = CFrame.new(L.at(c.x, c.top / 2, c.z)) })
	-- rails on three sides; the board side (south, over the water) is open
	part(m, { Name = "Rail", Size = Vector3.new(10.6, 3, 0.4), Color = WHITE, CFrame = CFrame.new(L.at(c.x, c.top + 1.5, c.z - 5.1)) })
	for _, s in ipairs({ -1, 1 }) do
		part(m, { Name = "Rail", Size = Vector3.new(0.4, 3, 10.6), Color = WHITE, CFrame = CFrame.new(L.at(c.x + s * 5.1, c.top + 1.5, c.z)) })
	end
	part(m, { Name = "Board", Size = Vector3.new(4, 0.6, 12), Color = AQUA, CFrame = CFrame.new(L.at(c.x, c.top - 0.3, c.z + 11)) })
	local climb = part(m, { Name = "ClimbPad", Shape = Enum.PartType.Cylinder, Size = Vector3.new(0.3, 7, 7), Color = CORAL, Material = Enum.Material.Neon, CanCollide = false,
		CFrame = CFrame.new(c.pad + Vector3.new(0, 0.15, 0)) * UPRIGHT })
	climb:SetAttribute("Climb", true)
	sign(m, L.at(c.x, c.top + 10, c.z), "CANNONBALL TOWER", CORAL, 18, 3.4)
	-- the springboard at the pool's west edge: land on it and it flings you out over the water
	local sb = L.Springboard
	local board = part(folder, { Name = "Springboard", Size = sb.size, Color = SUN, CFrame = sb.cf })
	board:SetAttribute("Bounce", sb.bounce)
	board:SetAttribute("Push", sb.push)
	part(folder, { Name = "SpringboardBase", Size = Vector3.new(4, 1.4, 5), Color = WHITE, CFrame = sb.cf * CFrame.new(-4, -1.0, 0) })
	sign(folder, sb.cf.Position + Vector3.new(-4, 7, 0), "SPRINGBOARD", Color3.fromRGB(30, 150, 210), 12, 2.6)
end

-- ---------- the splash pad: fountains, coloured spots, and the big tipping bucket ----------
local function fountain(parent, pos, height)
	local nozzle = part(parent, { Name = "Fountain", Size = Vector3.new(1.4, 0.4, 1.4), Color = WHITE, CFrame = CFrame.new(pos + Vector3.new(0, 0.2, 0)) })
	local e = Instance.new("ParticleEmitter")
	e.Texture = "rbxasset://textures/particles/sparkles_main.dds"
	e.Color = ColorSequence.new(Color3.fromRGB(225, 248, 255), Color3.fromRGB(120, 210, 255))
	e.LightEmission = 0.3
	e.Size = NumberSequence.new(0.8, 0.3)
	e.Transparency = NumberSequence.new(0.15, 1)
	e.Lifetime = NumberRange.new(0.9, 1.3)
	e.Rate = 14
	e.Speed = NumberRange.new(height or 24, (height or 24) + 4)
	e.SpreadAngle = Vector2.new(6, 6)
	e.Acceleration = Vector3.new(0, -45, 0)
	e.EmissionDirection = Enum.NormalId.Top
	e.Parent = nozzle
	return nozzle
end

local function splashPad(folder)
	local m = Instance.new("Model")
	m.Name = "SplashPad"
	m.Parent = folder
	local B = L.Bucket
	local colors = { CORAL, SUN, AQUA, Color3.fromRGB(150, 110, 240), Color3.fromRGB(110, 220, 140) }
	local rng = Random.new(77)
	for k = 1, 14 do -- bright spots painted on the floor
		local x, z = rng:NextNumber(L.SplashPad.x1 + 8, L.SplashPad.x2 - 8), rng:NextNumber(L.SplashPad.z1 + 8, L.SplashPad.z2 - 8)
		local d = rng:NextNumber(6, 12)
		part(m, { Name = "Spot", Shape = Enum.PartType.Cylinder, Size = Vector3.new(0.1, d, d), Color = colors[(k - 1) % #colors + 1], CanCollide = false, CanQuery = false,
			CFrame = CFrame.new(L.at(x, 0.05, z)) * UPRIGHT })
	end
	for k = 0, 7 do -- a ring of fountains round the bucket tower
		local a = k * math.pi / 4
		fountain(m, L.at(B.x + math.cos(a) * 26, 0, B.z + math.sin(a) * 26), 22 + (k % 2) * 6)
	end
	for _, q in ipairs({ { 56, 44 }, { 152, 44 }, { 56, 140 }, { 152, 140 } }) do
		fountain(m, L.at(q[1], 0, q[2]), 16)
	end
	-- the bucket tower: four legs, a frame on top, and the bucket on an axle. Every player's screen tips it (ParkPlay.client.lua).
	local tower = Instance.new("Model")
	tower.Name = "BucketTower"
	tower.Parent = m
	local H = B.height
	for _, cx in ipairs({ -1, 1 }) do
		for _, cz in ipairs({ -1, 1 }) do
			part(tower, { Name = "Leg", Size = Vector3.new(1.8, H, 1.8), Color = (cx == cz) and CORAL or AQUA, CFrame = CFrame.new(L.at(B.x + cx * 7, H / 2, B.z + cz * 7)) })
		end
		part(tower, { Name = "Beam", Size = Vector3.new(1.4, 1.4, 15.8), Color = SUN, CFrame = CFrame.new(L.at(B.x + cx * 7, H, B.z)) })
	end
	part(tower, { Name = "Axle", Shape = Enum.PartType.Cylinder, Size = Vector3.new(15.8, 0.8, 0.8), Color = WHITE, CFrame = CFrame.new(L.at(B.x, H, B.z)) })
	local bucket = Instance.new("Model")
	bucket.Name = "Bucket"
	bucket.Parent = tower
	local hinge = part(bucket, { Name = "Hinge", Size = Vector3.new(1, 1, 1), Transparency = 1, CanCollide = false, CanQuery = false, CanTouch = false, CFrame = CFrame.new(L.at(B.x, H, B.z)) })
	bucket.PrimaryPart = hinge
	part(bucket, { Name = "Pail", Shape = Enum.PartType.Cylinder, Size = Vector3.new(8, 11, 11), Color = SUN, CanCollide = false, CFrame = CFrame.new(L.at(B.x, H + 4.2, B.z)) * UPRIGHT })
	part(bucket, { Name = "Rim", Shape = Enum.PartType.Cylinder, Size = Vector3.new(0.8, 11.8, 11.8), Color = CORAL, CanCollide = false, CFrame = CFrame.new(L.at(B.x, H + 7.9, B.z)) * UPRIGHT })
	part(bucket, { Name = "Water", Shape = Enum.PartType.Cylinder, Size = Vector3.new(0.3, 10, 10), Color = Color3.fromRGB(90, 200, 255), Material = Enum.Material.Neon, CanCollide = false,
		CFrame = CFrame.new(L.at(B.x, H + 8.45, B.z)) * UPRIGHT })
	-- a sign on two legs counting down to the next tip (your screen updates it)
	local board = part(tower, { Name = "BucketSign", Size = Vector3.new(14, 3.2, 0.4), Color = WHITE, CFrame = CFrame.new(L.at(B.x, 9, B.z - 7.4)) })
	local l1 = surfaceText(board, Enum.NormalId.Front, "Bucket tips soon!", CORAL, 20)
	l1.Name = "BucketTimer"
	local l2 = surfaceText(board, Enum.NormalId.Back, "Bucket tips soon!", CORAL, 20)
	l2.Name = "BucketTimer"
	-- drips off the beams
	for _, cx in ipairs({ -1, 1 }) do
		local drip = part(tower, { Name = "Drip", Size = Vector3.new(1, 0.2, 10), Transparency = 1, CanCollide = false, CanQuery = false, CanTouch = false, CFrame = CFrame.new(L.at(B.x + cx * 7, H - 0.8, B.z)) })
		local e = Instance.new("ParticleEmitter")
		e.Texture = "rbxasset://textures/particles/sparkles_main.dds"
		e.Color = ColorSequence.new(Color3.fromRGB(200, 240, 255))
		e.Size = NumberSequence.new(0.5, 0.3)
		e.Lifetime = NumberRange.new(0.8, 1.1)
		e.Rate = 5
		e.Speed = NumberRange.new(2, 4)
		e.Acceleration = Vector3.new(0, -40, 0)
		e.EmissionDirection = Enum.NormalId.Bottom
		e.Parent = drip
	end
	return bucket
end

-- ---------- the hidden rubber ducks ----------
local function ducks(folder)
	local df = Instance.new("Folder")
	df.Name = "Ducks"
	df.Parent = folder
	local list = {}
	for _, d in ipairs(L.Ducks) do
		local ok, err = pcall(function()
			local m = Instance.new("Model")
			m.Name = "Duck_" .. d.id
			m:SetAttribute("DuckId", d.id)
			if d.floats then
				m:SetAttribute("Floats", true)
			end
			local at = CFrame.new(L.at(d.at.X, d.at.Y, d.at.Z)) * CFrame.Angles(0, (tonumber(d.id:match("%d+")) or 1) * 0.9, 0)
			local function bit(name, shape, size, color, offset)
				return part(m, { Name = name, Shape = shape, Size = size, Color = color, CanCollide = false, CastShadow = false, CFrame = at * offset })
			end
			local body = bit("Body", Enum.PartType.Ball, Vector3.new(1.8, 1.8, 1.8), Color3.fromRGB(255, 220, 60), CFrame.new())
			bit("Head", Enum.PartType.Ball, Vector3.new(1.2, 1.2, 1.2), Color3.fromRGB(255, 220, 60), CFrame.new(0, 1.0, -0.55))
			bit("Beak", Enum.PartType.Block, Vector3.new(0.7, 0.25, 0.55), Color3.fromRGB(255, 140, 40), CFrame.new(0, 0.9, -1.25))
			for _, s in ipairs({ -1, 1 }) do
				bit("Eye", Enum.PartType.Ball, Vector3.new(0.25, 0.25, 0.25), Color3.fromRGB(20, 20, 24), CFrame.new(s * 0.32, 1.18, -1.05))
			end
			bit("Tail", Enum.PartType.Ball, Vector3.new(0.7, 0.7, 0.7), Color3.fromRGB(255, 210, 50), CFrame.new(0, 0.35, 0.85))
			m.PrimaryPart = body
			local prompt = Instance.new("ProximityPrompt")
			prompt.ActionText = "Pick up"
			prompt.ObjectText = "Rubber Duck"
			prompt.HoldDuration = 0
			prompt.MaxActivationDistance = 8
			prompt.RequiresLineOfSight = false
			prompt:SetAttribute("DuckId", d.id)
			prompt.Parent = body
			m.Parent = df
			table.insert(list, { id = d.id, model = m, prompt = prompt })
		end)
		if not ok then
			warn("[Splash Lagoon] duck " .. tostring(d.id) .. " failed: " .. tostring(err))
		end
	end
	return list
end

-- builds the whole park; returns what the game logic needs, or nil if even the folder failed
function ParkBuilder.build()
	local folder = Instance.new("Folder")
	folder.Name = "SplashLagoon"
	folder.Parent = workspace
	local info = { folder = folder, spawn = L.Spawn, ducks = {}, bucket = nil }
	local function section(name, fn)
		local ok, res = pcall(fn)
		if not ok then
			warn("[Splash Lagoon] " .. name .. " failed to build: " .. tostring(res))
			return nil
		end
		return res
	end
	-- the ground and water are the one part the park can't do without: if they fail, the park stays closed (the station is untouched)
	local ground = section("terrain", function()
		terrain()
		return true
	end)
	if not ground then
		folder:Destroy()
		return nil
	end
	section("boundary", function()
		boundary(folder)
		return true
	end)
	section("decor", function()
		decor(folder)
		return true
	end)
	section("slides", function()
		slides(folder)
		return true
	end)
	section("cannonball tower", function()
		cannonball(folder)
		return true
	end)
	info.bucket = section("splash pad", function()
		return splashPad(folder)
	end)
	info.ducks = section("ducks", function()
		return ducks(folder)
	end) or {}
	local tokens = Instance.new("Folder")
	tokens.Name = "Tokens"
	tokens.Parent = folder
	info.tokens = tokens
	return info
end

return ParkBuilder
