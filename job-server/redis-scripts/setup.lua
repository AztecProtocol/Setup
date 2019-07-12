local from = tonumber(ARGV[1])
local numberOfJobs = tonumber(ARGV[2])

redis.pcall('flushall')
redis.pcall('set', 'from', from)
redis.pcall('set', 'to', from + numberOfJobs)
redis.pcall('del', 'pendingJobs')