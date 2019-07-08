# Generic Job Server

This is a small redis backed server that allows for the scheduling of jobs based on a job id integer.

# Running

1. `docker-compose build` to create `aztec/job-server`.
2. `docker-compose up` to run the image, mounting local code into the container and watching for changes.

# Endpoints

- `GET /create-jobs?num=10000` - Reset the entire system and add 10,000 jobs.
- `GET /job` - Return a job id to process. Optional `num` query parameter to request a batch.
- `PUT /complete/<job id>` - Mark the given job id as complete, and store the body as the result.
- `GET /result` - Download the results. This can be called early to stream the results as they arrive.
