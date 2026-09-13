package com.wave.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.wave.app.network.SocketManager
import com.wave.app.ui.AuthViewModel
import com.wave.app.ui.ChatListViewModel
import com.wave.app.ui.SelectedConversation
import com.wave.app.ui.ViewModelFactory
import com.wave.app.ui.screens.ChatInfoScreen
import com.wave.app.ui.screens.ChatListScreen
import com.wave.app.ui.screens.ChatScreen
import com.wave.app.ui.screens.LoginScreen
import com.wave.app.ui.screens.NewChatScreen
import com.wave.app.ui.screens.NewGroupScreen
import com.wave.app.ui.screens.RegisterScreen
import com.wave.app.ui.theme.WaveTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        val session = (application as WaveApplication).session

        setContent {
            WaveTheme {
                val navController = rememberNavController()
                val factory = ViewModelFactory(session)
                val startDestination = if (session.isLoggedIn()) "chats" else "login"

                if (session.isLoggedIn()) {
                    session.token?.let { SocketManager.connect(it) }
                }

                val motionSpec = tween<androidx.compose.ui.unit.IntOffset>(320, easing = androidx.compose.animation.core.FastOutSlowInEasing)
                val fadeSpec = tween<Float>(280)

                NavHost(
                    navController = navController,
                    startDestination = startDestination,
                    enterTransition = { slideInHorizontally(motionSpec) { it / 4 } + fadeIn(fadeSpec) },
                    exitTransition = { fadeOut(fadeSpec) },
                    popEnterTransition = { fadeIn(fadeSpec) },
                    popExitTransition = { slideOutHorizontally(motionSpec) { it / 4 } + fadeOut(fadeSpec) }
                ) {
                    composable("login") {
                        val vm: AuthViewModel = viewModel(factory = factory)
                        LoginScreen(
                            viewModel = vm,
                            onLoggedIn = {
                                navController.navigate("chats") {
                                    popUpTo("login") { inclusive = true }
                                }
                            },
                            onGoRegister = { navController.navigate("register") }
                        )
                    }
                    composable("register") {
                        val vm: AuthViewModel = viewModel(factory = factory)
                        RegisterScreen(
                            viewModel = vm,
                            onRegistered = {
                                navController.navigate("chats") {
                                    popUpTo("login") { inclusive = true }
                                }
                            },
                            onGoLogin = { navController.popBackStack() }
                        )
                    }
                    composable("chats") {
                        val vm: ChatListViewModel = viewModel(factory = factory)
                        ChatListScreen(
                            viewModel = vm,
                            onOpenConversation = { conv ->
                                SelectedConversation.current = conv
                                vm.markReadLocally(conv.id)
                                navController.navigate("chat")
                            },
                            onNewChat = { navController.navigate("newChat") },
                            onNewGroup = { navController.navigate("newGroup") },
                            onLogout = {
                                session.clear()
                                SocketManager.disconnect()
                                navController.navigate("login") {
                                    popUpTo(0) { inclusive = true }
                                }
                            }
                        )
                    }
                    composable("newChat") {
                        NewChatScreen(
                            onBack = { navController.popBackStack() },
                            onOpen = { conv ->
                                SelectedConversation.current = conv
                                navController.navigate("chat") {
                                    popUpTo("newChat") { inclusive = true }
                                }
                            }
                        )
                    }
                    composable("newGroup") {
                        NewGroupScreen(
                            onBack = { navController.popBackStack() },
                            onCreated = { conv ->
                                SelectedConversation.current = conv
                                navController.navigate("chat") {
                                    popUpTo("newGroup") { inclusive = true }
                                }
                            }
                        )
                    }
                    composable("chat") {
                        val conv = SelectedConversation.current
                        if (conv != null) {
                            ChatScreen(
                                session = session,
                                conversation = conv,
                                onBack = { navController.popBackStack() },
                                onOpenInfo = { navController.navigate("chatInfo") }
                            )
                        }
                    }
                    composable("chatInfo") {
                        val conv = SelectedConversation.current
                        if (conv != null) {
                            ChatInfoScreen(
                                conversation = conv,
                                onBack = { navController.popBackStack() },
                                onOpenConversation = { newConv ->
                                    SelectedConversation.current = newConv
                                    navController.navigate("chat") {
                                        popUpTo("chats")
                                    }
                                }
                            )
                        }
                    }
                }
            }
        }
    }
}
