from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from app.core.database import Base, engine
from app.endpoints.sockets import router as socket_router, socket_app
from app.endpoints.session import router as channel_session_router

app = FastAPI()
Base.metadata.create_all(bind=engine)

# Mount static files directory
app.mount("/static", StaticFiles(directory="static"), name="static")


# Add a direct route for privacy policy and toc
@app.get("/privacy-policy")
async def privacy_policy():
    return FileResponse("static/privacy_policy.html")


@app.get("/terms-of-service")
async def terms_of_service():
    return FileResponse("static/toc.html")


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:3002",
        "http://127.0.0.1:3003",
        "http://localhost:3002",
        "http://localhost:3003",
        "http://localhost:8080",
        "https://a7x4e30v7yvxn69xwyrjstxzjuc1go.ext-twitch.tv",
        "https://dashboard.twitch.tv",
        "https://twitch.tv",
    ],
    allow_origin_regex=r"https://.*\.ngrok-free\.app$|https?://.*\.ext-twitch\.tv$",
    allow_credentials=True,
    allow_methods=["*"],  # allow all HTTP methods
    allow_headers=["*"],  # allow all headers
)

# Include routers
app.include_router(socket_router, prefix="", tags=["Socket"])
app.include_router(channel_session_router, prefix="", tags=["Channel Sessions"])

# Mount the Socket.IO app (assumed to be created with a library like 'socketio')
app.mount("/", socket_app)

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
