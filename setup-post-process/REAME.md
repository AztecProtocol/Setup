# Post Processing Task Handler

The output of the MPC requires a large amount of post processing before it can be used.

This is a small container built on top of `setup-tools` that runs a number of task handlers
(default is the same as the number of cores). Each handler queries the `job-server` for
a job id, processes it, and writes the results back to the job server.

If there are no jobs to process it idles, checking for new jobs every second.

# Development

To run locally:

`docker-compose up`

This will start a `redis` instance, a `job-server` and run the task handler script.
The local volume scripts will be mounted into the container to ease development.

To create jobs on the job server you can:

`curl localhost:8080/create-jobs?num=16`

You should see the handlers start processing jobs.
