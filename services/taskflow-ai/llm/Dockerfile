# llama.cpp llama-server built for CPUs with AVX only (no AVX2/FMA), e.g. Xeon E5-2690 v2.
# The official prebuilt images assume AVX2 and would crash with "illegal instruction" on such hosts.
# Build with the same two-CPU cap as the runtime:  DOCKER_BUILDKIT=0 docker build --cpuset-cpus=<AI_CPUSET> ...
FROM debian:bookworm-slim AS build
ARG LLAMA_TAG=v0.7.0
RUN apt-get update && apt-get install -y --no-install-recommends git cmake g++ make ca-certificates && rm -rf /var/lib/apt/lists/*
RUN git clone --depth 1 --branch ${LLAMA_TAG} https://github.com/ggml-org/llama.cpp /src
WORKDIR /src
RUN cmake -B build -DCMAKE_BUILD_TYPE=Release \
      -DGGML_NATIVE=OFF -DGGML_AVX=ON -DGGML_AVX2=OFF -DGGML_FMA=OFF -DGGML_F16C=ON -DGGML_BMI2=OFF \
      -DGGML_OPENMP=ON -DLLAMA_CURL=OFF -DBUILD_SHARED_LIBS=OFF \
 && cmake --build build --config Release -j2 --target llama-server

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 curl && rm -rf /var/lib/apt/lists/* \
 && useradd -r -u 10002 llama
COPY --from=build /src/build/bin/llama-server /usr/local/bin/llama-server
USER llama
ENTRYPOINT ["/usr/local/bin/llama-server"]
