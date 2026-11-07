-- Splash Lagoon (2026-11-07, Matthew: "add another game to it but its a water park style game"): where everything in the water
-- park sits. Shared by the server, which builds it (ParkBuilder.lua), and each player's screen, which rides the slides, pushes the
-- waves and runs the lazy river (ParkPlay.client.lua). Positions here are local to the park: x east, z south, y up from the deck
-- (the deck's top is y = 0, the water's top is y = 0 too). L.at() turns them into world positions.
local L = {}

L.Name = "Splash Lagoon"
-- 4,000 studs east of the station: far past anything either side can see (the park also has its own fog on park players' screens)
L.Origin = Vector3.new(4000, 0, 0)
L.HalfX, L.HalfZ = 184, 168 -- half the park's size
L.GroundDepth = 16 -- the terrain ground is this thick (whole 4-stud terrain voxels)

function L.at(x, y, z)
	return L.Origin + Vector3.new(x, y, z)
end

local function loc(pos)
	return pos - L.Origin
end
L.toLocal = loc

local function inRect(p, r)
	return p.X >= r.x1 and p.X <= r.x2 and p.Z >= r.z1 and p.Z <= r.z2
end
L.inRect = inRect

-- anywhere in the park, with some room round the edge
function L.inPark(pos, margin)
	local p = loc(pos)
	margin = margin or 0
	return math.abs(p.X) <= L.HalfX + margin and math.abs(p.Z) <= L.HalfZ + margin and p.Y > -80 and p.Y < 220
end

-- where you arrive, facing into the park (east)
L.Spawn = CFrame.new(L.at(-160, 4, 0)) * CFrame.Angles(0, math.rad(-90), 0)

-- ---------- water (rectangles on the 4-stud terrain grid) ----------
-- the wave pool: a beach on its west side, getting deeper to the east; waves roll in from the deep end toward the beach
L.WavePool = { x1 = -136, x2 = -40, z1 = -136, z2 = -40 }
L.WaveBands = { { x1 = -136, x2 = -124, depth = 4 }, { x1 = -124, x2 = -108, depth = 8 }, { x1 = -108, x2 = -40, depth = 12 } }
L.Beach = { x1 = -168, x2 = -136, z1 = -136, z2 = -40 }
L.WaveEvery = 9 -- seconds between waves
L.WaveTravel = 5 -- seconds a wave takes to cross the pool

-- the lazy river: a square loop with an island in the middle; the current carries you round clockwise
L.River = {
	outer = { x1 = -136, x2 = -24, z1 = 40, z2 = 144 },
	inner = { x1 = -112, x2 = -48, z1 = 64, z2 = 120 },
	depth = 8,
	speed = 9, -- studs per second the current carries you
}
L.River.cx = (L.River.inner.x1 + L.River.inner.x2) / 2
L.River.cz = (L.River.inner.z1 + L.River.inner.z2) / 2

-- the splash pool: every slide ends here, and the cannonball tower stands over its north edge
L.SplashPool = { x1 = 16, x2 = 176, z1 = -152, z2 = -60, depth = 12 }

-- the splash pad (no deep water): fountains and the big tipping bucket
L.SplashPad = { x1 = 40, x2 = 168, z1 = 32, z2 = 152 }
L.Bucket = { x = 104, z = 90, height = 30, soakRadius = 16 }

-- is this world position in the water of...
local function wet(p)
	return p.Y < 1.5
end
function L.inWavePool(pos)
	local p = loc(pos)
	return wet(p) and inRect(p, L.WavePool)
end
function L.inRiver(pos)
	local p = loc(pos)
	return wet(p) and inRect(p, L.River.outer) and not inRect(p, L.River.inner)
end
function L.inSplashPool(pos)
	local p = loc(pos)
	return wet(p) and inRect(p, L.SplashPool)
end
function L.inAnyWater(pos)
	return L.inWavePool(pos) or L.inRiver(pos) or L.inSplashPool(pos)
end

-- which way the lazy river flows at a spot (a flat unit vector): along whichever side of the loop you are on, clockwise seen from above
function L.riverFlow(pos)
	local p = loc(pos)
	local dx, dz = p.X - L.River.cx, p.Z - L.River.cz
	local ix = (L.River.inner.x2 - L.River.inner.x1) / 2
	local iz = (L.River.inner.z2 - L.River.inner.z1) / 2
	if math.abs(dx) - ix > math.abs(dz) - iz then
		return Vector3.new(0, 0, dx > 0 and 1 or -1) -- east side flows south, west side flows north
	end
	return Vector3.new(dz < 0 and 1 or -1, 0, 0) -- north side flows east, south side flows west
end

-- the middle line of the river, as a loop of world points (for the drifting rings)
function L.riverLoop()
	local o, i = L.River.outer, L.River.inner
	local x1, x2 = (o.x1 + i.x1) / 2, (o.x2 + i.x2) / 2
	local z1, z2 = (o.z1 + i.z1) / 2, (o.z2 + i.z2) / 2
	return { L.at(x1, 0, z1), L.at(x2, 0, z1), L.at(x2, 0, z2), L.at(x1, 0, z2) } -- clockwise, same as the current
end

-- where the wave's crest is (local x), or nil between waves. t is the server's clock.
function L.waveCrestX(t)
	local phase = t % L.WaveEvery
	if phase > L.WaveTravel then
		return nil
	end
	return L.WavePool.x2 - (L.WavePool.x2 - L.WavePool.x1) * (phase / L.WaveTravel)
end

-- ---------- the slides ----------
-- Each slide is a list of points along its floor (world positions). Your own screen carries you along them at a set speed, seated,
-- and drops you in the splash pool at the end: no physics, so nobody can get stuck. speed = base + gain * sqrt(how far you've dropped).
local function corkscrew()
	local cx, cz, r = 40, -34, 13
	local top, bottom, turns = 40, 8, 2
	local pts = {}
	local steps = turns * 24 -- a point every 15 degrees
	for i = 0, steps do
		local a = -3 * math.pi + (i / steps) * turns * 2 * math.pi -- starts and ends on the west side, heading north
		local y = top - (top - bottom) * (i / steps)
		table.insert(pts, L.at(cx + r * math.cos(a), y, cz + r * math.sin(a)))
	end
	for _, q in ipairs({ { 7, -40 }, { 5.5, -48 }, { 4.2, -56 }, { 3.2, -62 }, { 2.6, -68 } }) do -- the run-out north into the pool
		table.insert(pts, L.at(cx - r, q[1], q[2]))
	end
	return pts
end

local function bigDrop()
	local x = 92
	local pts = {}
	for _, q in ipairs({
		{ 52, -38 }, { 51.8, -41 }, { 51, -43.5 }, { 49.4, -46 }, { 47, -48.5 }, { 44, -51 }, -- over the lip
		{ 36, -58 }, { 28, -65 }, { 20, -72 }, { 12, -79 }, -- straight down
		{ 8, -83 }, { 5.3, -87.5 }, { 3.8, -92.5 }, { 3.1, -98 }, { 2.8, -104 }, -- and out over the water
	}) do
		table.insert(pts, L.at(x, q[1], q[2]))
	end
	return pts
end

local function racer(x)
	local pts = {}
	local n = 16
	for k = 0, n do
		local d = k / n
		local y = 30 - 27 * d + 1.2 * math.sin(d * math.pi * 4) * (1 - d) -- gentle bumps on the way down
		table.insert(pts, L.at(x, y, -38 - 82 * d))
	end
	return pts
end

L.Slides = {
	{ id = "corkscrew", name = "Corkscrew", color = Color3.fromRGB(255, 120, 90), color2 = Color3.fromRGB(255, 220, 120),
		points = corkscrew(), splash = L.at(27, -2, -78), base = 22, gain = 2, tower = { x = 40, z = -34, w = 12, top = 40 },
		pad = L.at(40, 0, -16) },
	{ id = "bigdrop", name = "Big Drop", color = Color3.fromRGB(80, 170, 255), color2 = Color3.fromRGB(255, 255, 255),
		points = bigDrop(), splash = L.at(92, -2, -116), base = 20, gain = 5, tower = { x = 92, z = -34, w = 12, top = 52 },
		pad = L.at(92, 0, -16) },
	{ id = "racer1", name = "Rainbow Racer (left)", color = Color3.fromRGB(180, 110, 255), color2 = Color3.fromRGB(120, 230, 160),
		points = racer(140), splash = L.at(140, -2, -130), base = 18, gain = 2, countdown = true, tower = { x = 144, z = -34, w = 16, top = 30 },
		pad = L.at(140, 0, -16) },
	{ id = "racer2", name = "Rainbow Racer (right)", color = Color3.fromRGB(255, 200, 70), color2 = Color3.fromRGB(255, 130, 190),
		points = racer(148), splash = L.at(148, -2, -130), base = 18, gain = 2, countdown = true, noTower = true,
		pad = L.at(148, 0, -16) },
}
function L.slideById(id)
	for _, s in ipairs(L.Slides) do
		if s.id == id then
			return s
		end
	end
	return nil
end

-- ---------- the cannonball tower and the springboard ----------
L.Cannonball = { x = 96, z = -160, top = 24, pad = L.at(86, 0, -160), stand = CFrame.lookAt(L.at(96, 27, -160), L.at(96, 27, -150)) }
L.Springboard = { cf = CFrame.new(L.at(13, 1.4, -120)), size = Vector3.new(14, 0.6, 5), bounce = 70, push = 14 } -- sticks out over the pool's west edge

-- ---------- hidden rubber ducks (local x, y, z) ----------
L.Ducks = {
	{ id = "d1", at = Vector3.new(-164, 0.9, -132) }, -- the far corner of the beach
	{ id = "d2", at = Vector3.new(-178, 0.9, 30) }, -- behind where you arrive, by the hedge
	{ id = "d3", at = Vector3.new(-80, 0.9, 92) }, -- on the lazy river's island
	{ id = "d4", at = Vector3.new(-60, -11.1, -60) }, -- the bottom of the wave pool's deep end
	{ id = "d5", at = Vector3.new(92, 0.9, -52) }, -- under the Big Drop
	{ id = "d6", at = Vector3.new(99, 24.9, -163) }, -- up on the cannonball tower
	{ id = "d7", at = Vector3.new(130, -11.1, -136) }, -- the bottom of the splash pool
	{ id = "d8", at = Vector3.new(104, 0.9, 132) }, -- behind the bucket tower
	{ id = "d9", at = Vector3.new(178, 0.9, 160) }, -- the far south-east corner
	{ id = "d10", at = Vector3.new(0, 0.9, 20) }, -- by a palm tree on the main path
	{ id = "d11", at = Vector3.new(-178, 0.9, 162) }, -- the far south-west corner
	{ id = "d12", at = Vector3.new(-128, 0.4, 136), floats = true }, -- floating in a corner of the lazy river
}

-- ---------- where Splash Tokens can appear: { x1, x2, z1, z2, y } ----------
L.TokenAreas = {
	{ x1 = -140, x2 = 176, z1 = -10, z2 = 10, y = 2.6 }, -- the main path
	{ x1 = 44, x2 = 164, z1 = 36, z2 = 148, y = 2.6 }, -- the splash pad
	{ x1 = -168, x2 = -140, z1 = -132, z2 = -44, y = 2.6 }, -- the beach
	{ x1 = -36, x2 = 12, z1 = -148, z2 = 148, y = 2.6 }, -- the path between the pools
	{ x1 = -132, x2 = -28, z1 = 44, z2 = 60, y = 1.2 }, -- floating on the lazy river
	{ x1 = -132, x2 = -28, z1 = 124, z2 = 140, y = 1.2 },
	{ x1 = -132, x2 = -116, z1 = 64, z2 = 120, y = 1.2 },
	{ x1 = -44, x2 = -28, z1 = 64, z2 = 120, y = 1.2 },
	{ x1 = -132, x2 = -44, z1 = -132, z2 = -44, y = 1.2 }, -- floating on the wave pool
	{ x1 = 20, x2 = 172, z1 = -148, z2 = -64, y = 1.2 }, -- floating on the splash pool
}

return L
