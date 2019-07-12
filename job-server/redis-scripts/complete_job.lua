local job = ARGV[1]
local result = ARGV[2]
-- this is not the fastest as lrem is 0(n)
redis.pcall('lrem', 'pendingJobs', 1, job)

-- add the result to a sorted set by job id so we can return this later
redis.pcall('set', 'complete:'..job, result)

return 1