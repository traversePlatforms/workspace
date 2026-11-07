-- Splash Lagoon's rules on the server (2026-11-07): Splash Tokens to grab (they pay Stardust), the hidden rubber ducks (saved),
-- the water blaster (only ever a splash and a "SOAKED!": no damage, no knock-back, nobody sent anywhere), the bucket's timer,
-- splashes passed on to everyone in the park, and the Captain's two park buttons. Main.server.lua starts it inside a pcall, and
-- each piece below starts in its own, so a mistake here can't touch the station.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Config = require(ReplicatedStorage.Shared.Config)
local L = require(ReplicatedStorage.Shared.ParkLayout)

local ParkServer = {}

-- ctx: { info (from ParkBuilder), remote (the Park RemoteEvent), PlayerData, refreshStats, tell, isCaptain, now, addCommas, sfx }
function ParkServer.start(ctx)
	local P = Config.Park
	local info, remote = ctx.info, ctx.remote
	local folder = info.folder
	local rng = Random.new()

	local function inPark(p)
		return p and p.Parent and p:GetAttribute("Zone") == "park"
	end
	local function rootOf(p)
		local ch = p.Character
		return ch and ch:FindFirstChild("HumanoidRootPart")
	end
	-- send to everyone in the park (except one, if given)
	local function toPark(except, ...)
		for _, p in ipairs(Players:GetPlayers()) do
			if p ~= except and inPark(p) then
				remote:FireClient(p, ...)
			end
		end
	end
	local function tellPark(text, kind)
		for _, p in ipairs(Players:GetPlayers()) do
			if inPark(p) then
				ctx.tell(p, text, kind)
			end
		end
	end
	local function pay(player, amount)
		local d = ctx.PlayerData.get(player)
		if not d then
			return false
		end
		d.stardust += amount
		ctx.refreshStats(player)
		return true
	end
	local function safe(name, fn)
		local ok, err = pcall(fn)
		if not ok then
			warn("[Splash Lagoon] " .. name .. " failed to start: " .. tostring(err))
		end
	end
	local handlers = {} -- [kind] = function(player, ...) for messages from players' screens

	-- ---------- Splash Tokens ----------
	safe("tokens", function()
		local tokens = {} -- [part] = { bubble = bool }
		local function spot()
			local a = L.TokenAreas[rng:NextInteger(1, #L.TokenAreas)]
			return L.at(rng:NextNumber(a.x1, a.x2), a.y, rng:NextNumber(a.z1, a.z2))
		end
		local function makeToken(pos, bubble)
			local p = Instance.new("Part")
			p.Name = bubble and "Bubble" or "SplashToken"
			if bubble then
				p.Shape = Enum.PartType.Ball
				p.Size = Vector3.new(3, 3, 3)
				p.Material = Enum.Material.ForceField
				p.Color = Color3.fromRGB(150, 220, 255)
			else
				p.Shape = Enum.PartType.Cylinder -- a coin: its face looks along x, and your screen spins it
				p.Size = Vector3.new(0.5, 2.6, 2.6)
				p.Material = Enum.Material.Neon
				p.Color = Color3.fromRGB(255, 205, 70)
			end
			p.Anchored = true
			p.CanCollide = false
			p.CanQuery = false
			p.CanTouch = false
			p.CastShadow = false
			p.CFrame = CFrame.new(pos)
			p:SetAttribute("Ready", true)
			p.Parent = info.tokens
			tokens[p] = { bubble = bubble }
			return p
		end
		local function spawnToken()
			makeToken(spot(), false)
		end
		local function collect(player, p, rec)
			tokens[p] = nil
			if pay(player, P.tokenValue) then
				remote:FireClient(player, "pop", p.Position, "+" .. P.tokenValue .. " ★")
			end
			toPark(player, "poof", p.Position, rec.bubble)
			p:Destroy()
			if not rec.bubble then
				task.delay(rng:NextNumber(P.tokenRespawn[1], P.tokenRespawn[2]), spawnToken)
			end
		end
		for _ = 1, P.tokenCount do
			spawnToken()
		end
		task.spawn(function() -- the server's own check, a few times a second (your screen usually gets there first)
			local reach = P.tokenPickup
			while true do
				task.wait(0.15)
				for _, player in ipairs(Players:GetPlayers()) do
					local hrp = inPark(player) and rootOf(player)
					if hrp then
						local at = hrp.Position
						for p, rec in pairs(tokens) do
							if p.Parent and (p.Position - at).Magnitude <= reach then
								collect(player, p, rec)
							end
						end
					end
				end
			end
		end)
		handlers.token = function(player, p)
			if typeof(p) ~= "Instance" then
				return
			end
			local rec = tokens[p]
			local hrp = rootOf(player)
			if rec and hrp and p.Parent and (p.Position - hrp.Position).Magnitude <= P.tokenPickup + 8 then
				collect(player, p, rec)
			end
		end
		-- the Captain's Bubble Party: bubbles over the splash pad and the main path, each worth a token, gone after a while
		ParkServer.bubbleParty = function()
			for _ = 1, P.bubbleCount do
				local onPad = rng:NextNumber() < 0.6
				local r = onPad and L.SplashPad or { x1 = -120, x2 = 170, z1 = -10, z2 = 10 }
				local p = makeToken(L.at(rng:NextNumber(r.x1 + 6, r.x2 - 6), rng:NextNumber(3.2, 6.5), rng:NextNumber(r.z1 + 6, r.z2 - 6)), true)
				task.delay(P.bubbleSeconds, function()
					if p.Parent then
						tokens[p] = nil
						toPark(nil, "poof", p.Position, true)
						p:Destroy()
					end
				end)
			end
		end
	end)

	-- ---------- rubber ducks (saved with the rest of your PlayerData) ----------
	safe("ducks", function()
		local total = #L.Ducks
		local function refreshDucks(player)
			local d = ctx.PlayerData.get(player)
			if not d then
				return
			end
			local list, n = {}, 0
			for id in pairs(d.ducks or {}) do
				table.insert(list, id)
				n += 1
			end
			player:SetAttribute("DucksFound", table.concat(list, ","))
			player:SetAttribute("DuckCount", n)
			player:SetAttribute("DuckTotal", total)
		end
		local function hook(player)
			task.spawn(function()
				local t0 = os.clock()
				while player.Parent and not ctx.PlayerData.get(player) and os.clock() - t0 < 20 do
					task.wait(0.25)
				end
				if player.Parent then
					refreshDucks(player)
				end
			end)
		end
		Players.PlayerAdded:Connect(hook)
		for _, p in ipairs(Players:GetPlayers()) do
			hook(p)
		end
		for _, duck in ipairs(info.ducks or {}) do
			duck.prompt.Triggered:Connect(function(player)
				if not inPark(player) then
					return
				end
				local d = ctx.PlayerData.get(player)
				if not d then
					return
				end
				d.ducks = d.ducks or {}
				if d.ducks[duck.id] then
					ctx.tell(player, "You've already found this duck!", "info")
					return
				end
				d.ducks[duck.id] = true
				local n = 0
				for _ in pairs(d.ducks) do
					n += 1
				end
				pay(player, P.duckValue)
				refreshDucks(player)
				ctx.sfx("duck", nil, player)
				remote:FireClient(player, "duck", duck.model:GetPivot().Position, n, total)
				ctx.tell(player, "You found a rubber duck! " .. n .. " of " .. total .. ". +" .. ctx.addCommas(P.duckValue) .. " Stardust", "good")
				if n >= total then
					pay(player, P.duckAllBonus)
					ctx.tell(player, "You found EVERY rubber duck! Duck Master! +" .. ctx.addCommas(P.duckAllBonus) .. " Stardust", "cosmic")
					tellPark(player.DisplayName .. " found all " .. total .. " rubber ducks!", "rare")
				end
			end)
		end
	end)

	-- ---------- the water blaster: a splash and a SOAKED!, nothing else ----------
	safe("blaster", function()
		local last = {}
		handlers.soak = function(player)
			local t = os.clock()
			if (last[player] or 0) + P.soakCooldown > t then
				return
			end
			last[player] = t
			local hrp = rootOf(player)
			if not (hrp and inPark(player)) then
				return
			end
			local look = hrp.CFrame.LookVector
			local best, bestD = nil, math.huge
			for _, other in ipairs(Players:GetPlayers()) do
				local oh = other ~= player and inPark(other) and rootOf(other)
				if oh then
					local v = oh.Position - hrp.Position
					local d = v.Magnitude
					if d <= P.soakRange and d < bestD and (d < 4 or v.Unit:Dot(look) > 0.6) then
						best, bestD = other, d
					end
				end
			end
			local landAt = hrp.Position + look * (P.soakRange * 0.8) + Vector3.new(0, -2, 0)
			if best then
				local oh = rootOf(best)
				landAt = oh and oh.Position or landAt
				remote:FireClient(best, "soaked", player.DisplayName)
				remote:FireClient(player, "soakhit", best)
			end
			toPark(player, "spray", player, landAt)
		end
	end)

	-- ---------- splashes from slides and cannonballs, passed on to everyone else in the park ----------
	safe("splashes", function()
		local last = {}
		handlers.splash = function(player, pos, size)
			local t = os.clock()
			if typeof(pos) ~= "Vector3" or not L.inPark(pos, 10) or (last[player] or 0) + 0.4 > t then
				return
			end
			last[player] = t
			size = typeof(size) == "number" and math.clamp(size, 0.5, 3) or 1
			toPark(player, "splash", pos, size)
		end
	end)

	-- ---------- the big bucket on the splash pad tips every Config.Park.bucketEvery seconds ----------
	safe("bucket", function()
		task.spawn(function()
			while true do
				folder:SetAttribute("BucketNext", ctx.now() + P.bucketEvery)
				task.wait(P.bucketEvery)
				toPark(nil, "bucket")
			end
		end)
	end)

	-- ---------- the Captain's park buttons: Giant Wave and Bubble Party ----------
	safe("captain", function()
		local lastUse = {}
		handlers.captain = function(player, id)
			if not (ctx.isCaptain(player) and inPark(player)) then
				return
			end
			if id ~= "wave" and id ~= "bubbles" then
				return
			end
			local t = os.clock()
			local cd = P.captainCooldowns[id] or 20
			if (lastUse[id] or 0) + cd > t then
				ctx.tell(player, "Recharging: " .. math.ceil(lastUse[id] + cd - t) .. "s", "info")
				return
			end
			lastUse[id] = t
			if id == "wave" then
				folder:SetAttribute("GiantWaveAt", ctx.now())
				toPark(nil, "giantwave")
				tellPark("Captain's orders: a GIANT WAVE in the wave pool!", "cosmic")
			else
				if ParkServer.bubbleParty then
					ParkServer.bubbleParty()
				end
				toPark(nil, "bubbles", P.bubbleSeconds)
				tellPark("Captain's orders: BUBBLE PARTY! Pop the bubbles for Stardust!", "cosmic")
			end
		end
	end)

	remote.OnServerEvent:Connect(function(player, kind, ...)
		local h = typeof(kind) == "string" and handlers[kind]
		if h then
			local ok, err = pcall(h, player, ...)
			if not ok then
				warn("[Splash Lagoon] " .. kind .. ": " .. tostring(err))
			end
		end
	end)
	folder:SetAttribute("Ready", true)
	workspace:SetAttribute("ParkReady", true)
end

return ParkServer
